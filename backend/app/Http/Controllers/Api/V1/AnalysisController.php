<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TransactionType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AnalysisRequest;
use App\Http\Resources\Api\V1\TransactionResource;
use App\Models\Transaction;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class AnalysisController extends Controller
{
    public function __invoke(AnalysisRequest $request): JsonResponse
    {
        $currency = $request->validated('currency', 'EUR');
        $now = CarbonImmutable::now(config('app.timezone'));
        $currentStart = $now->startOfMonth();
        $previousStart = $currentStart->subMonth();
        $previousEnd = $previousStart
            ->addDays($now->day - 1)
            ->min($previousStart->endOfMonth());
        $expenses = $request->user()->transactions()
            ->where('type', TransactionType::Expense)
            ->where('currency', $currency)
            ->whereDate('occurred_on', '>=', $now->subMonths(6)->startOfDay())
            ->orderByDesc('occurred_on')->get();
        $current = $expenses->filter(fn (Transaction $item): bool => $item->occurred_on->between($currentStart, $now));
        $previous = $expenses->filter(fn (Transaction $item): bool => $item->occurred_on->between($previousStart, $previousEnd));
        $categorizedCurrent = $current->filter(fn (Transaction $item): bool => filled($item->category));
        $currentTotal = round((float) $current->sum('amount'), 2);
        $previousTotal = round((float) $previous->sum('amount'), 2);
        $categorizedTotal = round((float) $categorizedCurrent->sum('amount'), 2);
        $categories = $categorizedCurrent
            ->groupBy(fn (Transaction $item): string => (string) $item->category)
            ->map(function (Collection $items, string $category) use ($categorizedTotal): array {
                $amount = round((float) $items->sum('amount'), 2);

                return [
                    'category' => $category,
                    'amount' => number_format($amount, 2, '.', ''),
                    'percentage' => round($categorizedTotal > 0 ? $amount / $categorizedTotal * 100 : 0, 1),
                    'transaction_count' => $items->count(),
                ];
            })
            ->sortByDesc(fn (array $item): float => (float) $item['amount'])
            ->values()
            ->all();
        $duplicates = $this->duplicates($expenses, $request);
        $anomalies = $this->anomalies($expenses, $request);

        return response()->json(['data' => [
            'currency' => $currency,
            'insights' => $this->insights($categorizedCurrent, $previous->filter(fn (Transaction $item): bool => filled($item->category))),
            'duplicates' => $duplicates,
            'anomalies' => $anomalies,
            'sample_size' => $expenses->count(),
            'period' => [
                'from' => $currentStart->toDateString(),
                'to' => $now->toDateString(),
                'previous_from' => $previousStart->toDateString(),
                'previous_to' => $previousEnd->toDateString(),
            ],
            'summary' => [
                'current_expenses' => number_format($currentTotal, 2, '.', ''),
                'previous_comparable_expenses' => number_format($previousTotal, 2, '.', ''),
                'change_percentage' => $previousTotal > 0
                    ? round((($currentTotal - $previousTotal) / $previousTotal) * 100, 1)
                    : null,
                'categorized_expenses' => number_format($categorizedTotal, 2, '.', ''),
                'category_coverage_percentage' => $currentTotal > 0
                    ? round($categorizedTotal / $currentTotal * 100, 1)
                    : 0,
            ],
            'categories' => $categories,
            'data_quality' => [
                'current_expenses' => $current->count(),
                'current_categorized_expenses' => $categorizedCurrent->count(),
                'previous_comparable_expenses' => $previous->count(),
            ],
            'status' => [
                'insights' => $categorizedCurrent->count() >= 3 ? 'ready' : 'insufficient',
                'duplicates' => $expenses->count() < 2 ? 'insufficient' : ($duplicates === [] ? 'clear' : 'findings'),
                'anomalies' => $expenses->count() < 5 ? 'insufficient' : ($anomalies === [] ? 'clear' : 'findings'),
            ],
        ]]);
    }

    /** @param Collection<int, Transaction> $current @param Collection<int, Transaction> $previous */
    private function insights(Collection $current, Collection $previous): array
    {
        if ($current->count() < 3) {
            return [];
        }

        $currentTotal = (float) $current->sum('amount');
        $previousTotal = (float) $previous->sum('amount');
        $categories = $current->groupBy(fn (Transaction $item): string => (string) $item->category)
            ->map(fn (Collection $items): float => round((float) $items->sum('amount'), 2))->sortDesc();
        $topCategory = (string) $categories->keys()->first();
        $topTotal = (float) $categories->first();
        $insights = [[
            'kind' => 'category',
            'title' => "La categoria principale è {$topCategory}",
            'message' => sprintf('Rappresenta il %.0f%% delle uscite categorizzate del mese (%s).', $currentTotal > 0 ? $topTotal / $currentTotal * 100 : 0, number_format($topTotal, 2, ',', '.')),
            'potential_saving' => '0.00',
        ]];

        if ($previous->count() >= 3 && $previousTotal > 0) {
            $change = (($currentTotal - $previousTotal) / $previousTotal) * 100;
            $difference = max(0, $currentTotal - $previousTotal);
            $insights[] = [
                'kind' => $change > 0 ? 'increase' : 'improvement',
                'title' => $change > 0 ? 'Le uscite stanno aumentando' : 'Le uscite stanno diminuendo',
                'message' => sprintf('Hai speso il %.0f%% %s rispetto allo stesso periodo del mese scorso.', abs($change), $change > 0 ? 'in più' : 'in meno'),
                'potential_saving' => number_format($difference, 2, '.', ''),
            ];
        }

        return $insights;
    }

    /** @param Collection<int, Transaction> $expenses */
    private function duplicates(Collection $expenses, AnalysisRequest $request): array
    {
        return $expenses->filter(fn (Transaction $item): bool => $item->occurred_on->gte(now()->subDays(90)))
            ->groupBy(function (Transaction $item): string {
                $label = Str::lower(Str::squish($item->merchant ?: $item->description));

                return implode('|', [$item->occurred_on->toDateString(), $item->amount, $label]);
            })->filter(fn (Collection $items): bool => $items->count() > 1)->values()
            ->map(fn (Collection $items): array => [
                'reason' => 'Stessa data, importo ed esercente o descrizione',
                'transactions' => $items->map(fn (Transaction $item): array => (new TransactionResource($item))->resolve($request))->values(),
            ])->all();
    }

    /** @param Collection<int, Transaction> $expenses */
    private function anomalies(Collection $expenses, AnalysisRequest $request): array
    {
        if ($expenses->count() < 5) {
            return [];
        }

        $amounts = $expenses->map(fn (Transaction $item): float => (float) $item->amount);
        $mean = (float) $amounts->avg();
        $deviation = sqrt((float) $amounts->avg(fn (float $amount): float => ($amount - $mean) ** 2));
        $threshold = max($mean + 2 * $deviation, (float) $amounts->median() * 2);

        return $expenses->filter(fn (Transaction $item): bool => (float) $item->amount > $threshold)->take(10)
            ->map(fn (Transaction $item): array => [
                'reason' => sprintf('Importo superiore alla soglia abituale di %s', number_format($threshold, 2, ',', '.')),
                'transaction' => (new TransactionResource($item))->resolve($request),
            ])->values()->all();
    }
}
