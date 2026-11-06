<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TransactionType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\IndexCategoryBudgetRequest;
use App\Http\Requests\Api\V1\StoreCategoryBudgetRequest;
use App\Models\CategoryBudget;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class CategoryBudgetController extends Controller
{
    public function index(IndexCategoryBudgetRequest $request): JsonResponse
    {
        $currency = $request->validated('currency', 'EUR');
        $month = CarbonImmutable::createFromFormat(
            'Y-m',
            $request->validated('month', now(config('app.timezone'))->format('Y-m')),
            config('app.timezone'),
        )->startOfMonth();

        $budgets = $request->user()->categoryBudgets()
            ->where('currency', $currency)
            ->whereDate('period_month', $month)
            ->orderBy('category')
            ->get();
        $spentByCategory = $request->user()->transactions()
            ->where('type', TransactionType::Expense)
            ->where('currency', $currency)
            ->whereBetween('occurred_on', [$month, $month->endOfMonth()])
            ->whereIn('category', $budgets->pluck('category'))
            ->selectRaw('category, SUM(amount) as total')
            ->groupBy('category')
            ->pluck('total', 'category');

        $items = $budgets->map(function (CategoryBudget $budget) use ($spentByCategory): array {
            $limit = (float) $budget->amount;
            $spent = (float) ($spentByCategory[$budget->category] ?? 0);
            $percentage = $limit > 0 ? round($spent / $limit * 100, 1) : 0;

            return [
                'id' => $budget->id,
                'category' => $budget->category,
                'limit' => number_format($limit, 2, '.', ''),
                'spent' => number_format($spent, 2, '.', ''),
                'remaining' => number_format($limit - $spent, 2, '.', ''),
                'percentage' => $percentage,
                'status' => $percentage > 100 ? 'exceeded' : ($percentage >= 80 ? 'warning' : 'on_track'),
            ];
        })->values();

        return response()->json(['data' => [
            'month' => $month->format('Y-m'),
            'currency' => $currency,
            'total_budget' => number_format($budgets->sum(fn (CategoryBudget $budget): float => (float) $budget->amount), 2, '.', ''),
            'total_spent' => number_format($items->sum(fn (array $item): float => (float) $item['spent']), 2, '.', ''),
            'total_remaining' => number_format($items->sum(fn (array $item): float => (float) $item['remaining']), 2, '.', ''),
            'items' => $items,
        ]]);
    }

    public function store(StoreCategoryBudgetRequest $request): JsonResponse
    {
        $attributes = $request->validated();
        $budget = $request->user()->categoryBudgets()->updateOrCreate(
            [
                'category' => $attributes['category'],
                'currency' => $attributes['currency'],
                'period_month' => CarbonImmutable::createFromFormat('Y-m', $attributes['month'])->startOfMonth(),
            ],
            ['amount' => $attributes['amount']],
        );

        return response()->json(['data' => [
            'id' => $budget->id,
            'category' => $budget->category,
            'amount' => $budget->amount,
            'currency' => $budget->currency,
            'month' => $budget->period_month->format('Y-m'),
        ]], $budget->wasRecentlyCreated ? 201 : 200);
    }

    public function destroy(CategoryBudget $categoryBudget): Response
    {
        $categoryBudget->delete();

        return response()->noContent();
    }
}
