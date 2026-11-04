<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TransactionType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\PlanningRequest;
use App\Models\Transaction;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class PlanningController extends Controller
{
    public function __invoke(PlanningRequest $request): JsonResponse
    {
        $currency = $request->validated('currency', 'EUR');
        $now = CarbonImmutable::now(config('app.timezone'));
        $transactions = $request->user()->transactions()
            ->where('currency', $currency)
            ->whereDate('occurred_on', '<=', $now)
            ->orderBy('occurred_on')->get();

        return response()->json(['data' => [
            'currency' => $currency,
            'future_balance' => $this->futureBalance($transactions, $now),
            'subscriptions' => $this->subscriptions($transactions, $now),
        ]]);
    }

    /** @param Collection<int, Transaction> $transactions */
    private function futureBalance(Collection $transactions, CarbonImmutable $now): array
    {
        $balance = $transactions->sum(fn (Transaction $item): float => (float) $item->amount * ($item->type === TransactionType::Income ? 1 : -1));
        $recent = $transactions->filter(fn (Transaction $item): bool => $item->occurred_on->gte($now->subDays(89)));
        $firstDate = $recent->first()?->occurred_on;
        $observedDays = $firstDate ? max(1, min(90, (int) $firstDate->diffInDays($now) + 1)) : 0;
        $net = $recent->sum(fn (Transaction $item): float => (float) $item->amount * ($item->type === TransactionType::Income ? 1 : -1));
        $dailyAverage = $observedDays > 0 ? $net / $observedDays : 0;
        $daysRemaining = (int) $now->diffInDays($now->endOfMonth());
        $sampleSize = $recent->count();

        return [
            'current_balance' => number_format($balance, 2, '.', ''),
            'projected_balance' => number_format($balance + $dailyAverage * $daysRemaining, 2, '.', ''),
            'average_daily_net' => number_format($dailyAverage, 2, '.', ''),
            'days_remaining' => $daysRemaining,
            'sample_size' => $sampleSize,
            'confidence' => $sampleSize >= 30 && $observedDays >= 60 ? 'high' : ($sampleSize >= 10 && $observedDays >= 30 ? 'medium' : 'low'),
        ];
    }

    /** @param Collection<int, Transaction> $transactions */
    private function subscriptions(Collection $transactions, CarbonImmutable $now): array
    {
        return $transactions
            ->filter(fn (Transaction $item): bool => $item->type === TransactionType::Expense && $item->occurred_on->gte($now->subDays(800)))
            ->groupBy(fn (Transaction $item): string => Str::lower(Str::squish($item->merchant ?: $item->description)))
            ->filter(fn (Collection $items): bool => $items->count() >= 3)
            ->map(function (Collection $items, string $label): ?array {
                $sorted = $items->sortBy('occurred_on')->values();
                $intervals = $sorted->zip($sorted->slice(1))->filter(fn (Collection $pair): bool => isset($pair[1]))
                    ->map(fn (Collection $pair): int => (int) $pair[0]->occurred_on->diffInDays($pair[1]->occurred_on));
                $averageInterval = (float) $intervals->avg();
                $frequency = match (true) {
                    $averageInterval >= 25 && $averageInterval <= 35 => 'monthly',
                    $averageInterval >= 330 && $averageInterval <= 400 => 'yearly',
                    default => null,
                };
                $amounts = $sorted->map(fn (Transaction $item): float => (float) $item->amount);
                $averageAmount = (float) $amounts->avg();
                $maxDeviation = $averageAmount > 0 ? $amounts->max(fn (float $amount): float => abs($amount - $averageAmount)) / $averageAmount : 1;

                if ($frequency === null || $maxDeviation > 0.15) {
                    return null;
                }

                $last = $sorted->last();

                return [
                    'label' => $last->merchant ?: Str::headline($label),
                    'average_amount' => number_format($averageAmount, 2, '.', ''),
                    'frequency' => $frequency,
                    'occurrences' => $sorted->count(),
                    'last_charge_on' => $last->occurred_on->toDateString(),
                    'next_expected_on' => $last->occurred_on->copy()->addDays((int) round($averageInterval))->toDateString(),
                ];
            })->filter()->sortByDesc('average_amount')->values()->all();
    }
}
