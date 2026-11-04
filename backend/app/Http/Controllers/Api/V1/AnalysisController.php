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
        $expenses = $request->user()->transactions()
            ->where('type', TransactionType::Expense)
            ->where('currency', $currency)
            ->whereDate('occurred_on', '>=', $now->subMonths(6)->startOfDay())
            ->orderByDesc('occurred_on')->get();
        $current = $expenses->filter(fn (Transaction $item): bool => $item->occurred_on->between($currentStart, $now));
        $previous = $expenses->filter(fn (Transaction $item): bool => $item->occurred_on->between($previousStart, $currentStart->subDay()));

        return response()->json(['data' => [
            'currency' => $currency,
            'insights' => $this->insights($current, $previous),
            'duplicates' => $this->duplicates($expenses, $request),
            'anomalies' => $this->anomalies($expenses, $request),
            'sample_size' => $expenses->count(),
        ]]);
    }

    /** @param Collection<int, Transaction> $current @param Collection<int, Transaction> $previous */
    private function insights(Collection $current, Collection $previous): array
    {
        if ($current->isEmpty()) {
            return [];
        }

        $currentTotal = (float) $current->sum('amount');
        $previousTotal = (float) $previous->sum('amount');
        $categories = $current->groupBy(fn (Transaction $item): string => $item->category ?: 'Senza categoria')
            ->map(fn (Collection $items): float => round((float) $items->sum('amount'), 2))->sortDesc();
        $topCategory = (string) $categories->keys()->first();
        $topTotal = (float) $categories->first();
        $insights = [[
            'kind' => 'category',
            'title' => "La categoria principale è {$topCategory}",
            'message' => sprintf('Rappresenta il %.0f%% delle uscite del mese (%s).', $currentTotal > 0 ? $topTotal / $currentTotal * 100 : 0, number_format($topTotal, 2, ',', '.')),
            'potential_saving' => number_format($topTotal * 0.1, 2, '.', ''),
        ]];

        if ($previousTotal > 0) {
            $change = (($currentTotal - $previousTotal) / $previousTotal) * 100;
            $insights[] = [
                'kind' => $change > 0 ? 'increase' : 'improvement',
                'title' => $change > 0 ? 'Le uscite stanno aumentando' : 'Le uscite stanno diminuendo',
                'message' => sprintf('Hai speso il %.0f%% %s rispetto al mese scorso.', abs($change), $change > 0 ? 'in più' : 'in meno'),
                'potential_saving' => number_format(max(0, $currentTotal - $previousTotal), 2, '.', ''),
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
