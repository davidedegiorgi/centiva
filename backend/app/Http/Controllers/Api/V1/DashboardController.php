<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TransactionType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\DashboardRequest;
use App\Http\Resources\Api\V1\TransactionResource;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __invoke(DashboardRequest $request): JsonResponse
    {
        $currency = $request->validated('currency', 'EUR');
        $monthStart = now()->startOfMonth();
        $monthEnd = now()->endOfMonth();
        $previousMonthStart = $monthStart->copy()->subMonth();
        $previousMonthEnd = $monthStart->copy()->subDay();

        $transactions = $request->user()
            ->transactions()
            ->where('currency', $currency);

        $monthTotals = (clone $transactions)
            ->whereBetween('occurred_on', [$monthStart->toDateString(), $monthEnd->toDateString()])
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN type = ? THEN amount ELSE 0 END), 0) AS income',
                [TransactionType::Income->value],
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN type = ? THEN amount ELSE 0 END), 0) AS expenses',
                [TransactionType::Expense->value],
            )
            ->firstOrFail();

        $monthlyComparison = collect(range(5, 0))
            ->map(function (int $monthsAgo) use ($transactions): array {
                $periodStart = now()->startOfMonth()->subMonths($monthsAgo);
                $periodEnd = $periodStart->copy()->endOfMonth();
                $totals = (clone $transactions)
                    ->whereBetween('occurred_on', [$periodStart->toDateString(), $periodEnd->toDateString()])
                    ->selectRaw(
                        'COALESCE(SUM(CASE WHEN type = ? THEN amount ELSE 0 END), 0) AS income',
                        [TransactionType::Income->value],
                    )
                    ->selectRaw(
                        'COALESCE(SUM(CASE WHEN type = ? THEN amount ELSE 0 END), 0) AS expenses',
                        [TransactionType::Expense->value],
                    )
                    ->firstOrFail();

                $income = (float) $totals->income;
                $expenses = (float) $totals->expenses;

                return [
                    'month' => $periodStart->format('Y-m'),
                    'income' => (string) $totals->income,
                    'expenses' => (string) $totals->expenses,
                    'net_savings' => number_format($income - $expenses, 2, '.', ''),
                ];
            });

        $previousExpenses = (clone $transactions)
            ->where('type', TransactionType::Expense)
            ->whereBetween('occurred_on', [
                $previousMonthStart->toDateString(),
                $previousMonthEnd->toDateString(),
            ])
            ->sum('amount');

        $daily = (clone $transactions)
            ->whereBetween('occurred_on', [$monthStart->toDateString(), $monthEnd->toDateString()])
            ->select('occurred_on')
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN type = ? THEN amount ELSE 0 END), 0) AS income',
                [TransactionType::Income->value],
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN type = ? THEN amount ELSE 0 END), 0) AS expenses',
                [TransactionType::Expense->value],
            )
            ->groupBy('occurred_on')
            ->orderBy('occurred_on')
            ->get()
            ->map(fn ($row): array => [
                'date' => $row->occurred_on->toDateString(),
                'income' => (string) $row->income,
                'expenses' => (string) $row->expenses,
            ]);

        $categories = (clone $transactions)
            ->where('type', TransactionType::Expense)
            ->whereBetween('occurred_on', [$monthStart->toDateString(), $monthEnd->toDateString()])
            ->selectRaw("COALESCE(category, 'Senza categoria') AS category")
            ->selectRaw('SUM(amount) AS total')
            ->groupByRaw("COALESCE(category, 'Senza categoria')")
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row): array => [
                'category' => $row->category,
                'total' => (string) $row->total,
            ]);

        $recent = (clone $transactions)
            ->orderByDesc('occurred_on')
            ->orderByDesc('id')
            ->limit(5)
            ->get();

        $currentExpenses = (float) $monthTotals->expenses;
        $currentIncome = (float) $monthTotals->income;
        $previousExpensesValue = (float) $previousExpenses;
        $expenseChangePercentage = $previousExpensesValue > 0
            ? round((($currentExpenses - $previousExpensesValue) / $previousExpensesValue) * 100, 1)
            : null;

        return response()->json([
            'data' => [
                'currency' => $currency,
                'period' => [
                    'from' => $monthStart->toDateString(),
                    'to' => $monthEnd->toDateString(),
                ],
                'summary' => [
                    'income' => (string) $monthTotals->income,
                    'expenses' => (string) $monthTotals->expenses,
                    'net_savings' => number_format($currentIncome - $currentExpenses, 2, '.', ''),
                    'previous_month_expenses' => (string) $previousExpenses,
                    'expense_change_percentage' => $expenseChangePercentage,
                ],
                'daily' => $daily,
                'monthly_comparison' => $monthlyComparison,
                'categories' => $categories,
                'recent' => TransactionResource::collection($recent)->resolve(),
            ],
        ]);
    }
}
