<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TransactionSource;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\IndexTransactionRequest;
use App\Http\Requests\Api\V1\StoreTransactionRequest;
use App\Http\Requests\Api\V1\UpdateTransactionRequest;
use App\Http\Resources\Api\V1\TransactionResource;
use App\Models\Transaction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class TransactionController extends Controller
{
    public function index(IndexTransactionRequest $request): AnonymousResourceCollection
    {
        $filters = $request->validated();
        $sort = $filters['sort'] ?? 'occurred_on';
        $order = $filters['order'] ?? 'desc';

        $transactions = $request->user()
            ->transactions()
            ->when($filters['search'] ?? null, function (Builder $query, string $search): void {
                $pattern = '%'.$search.'%';

                $query->where(function (Builder $query) use ($pattern): void {
                    $query
                        ->whereLike('description', $pattern, caseSensitive: false)
                        ->orWhereLike('merchant', $pattern, caseSensitive: false)
                        ->orWhereLike('category', $pattern, caseSensitive: false);
                });
            })
            ->when(
                $filters['type'] ?? null,
                fn (Builder $query, string $type): Builder => $query->where('type', $type),
            )
            ->when(
                $filters['category'] ?? null,
                fn (Builder $query, string $category): Builder => $query->where('category', $category),
            )
            ->when(
                $filters['date_from'] ?? null,
                fn (Builder $query, string $date): Builder => $query->whereDate('occurred_on', '>=', $date),
            )
            ->when(
                $filters['date_to'] ?? null,
                fn (Builder $query, string $date): Builder => $query->whereDate('occurred_on', '<=', $date),
            )
            ->when(
                $filters['amount_min'] ?? null,
                fn (Builder $query, string $amount): Builder => $query->where('amount', '>=', $amount),
            )
            ->when(
                $filters['amount_max'] ?? null,
                fn (Builder $query, string $amount): Builder => $query->where('amount', '<=', $amount),
            )
            ->orderBy($sort, $order)
            ->orderBy('id', $order)
            ->paginate($filters['per_page'] ?? 25)
            ->withQueryString();

        return TransactionResource::collection($transactions);
    }

    public function store(StoreTransactionRequest $request): JsonResponse
    {
        $attributes = $request->safe()->only([
            'type',
            'amount',
            'currency',
            'occurred_on',
            'category',
        ]);
        $attributes['source'] = TransactionSource::Manual;
        $attributes['description'] = 'Movimento manuale';
        $attributes['merchant'] = null;
        $attributes['notes'] = null;

        $transaction = $request->user()->transactions()->create($attributes);

        return (new TransactionResource($transaction))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Transaction $transaction): JsonResponse
    {
        return (new TransactionResource($transaction))->response();
    }

    public function update(
        UpdateTransactionRequest $request,
        Transaction $transaction,
    ): JsonResponse {
        $attributes = $request->safe()->only([
            'type',
            'amount',
            'currency',
            'occurred_on',
            'category',
        ]);

        if ($transaction->source === TransactionSource::Manual) {
            $attributes['description'] = 'Movimento manuale';
            $attributes['merchant'] = null;
            $attributes['notes'] = null;
        }

        $transaction->update($attributes);

        return (new TransactionResource($transaction->refresh()))->response();
    }

    public function destroy(Transaction $transaction): Response
    {
        $transaction->delete();

        return response()->noContent();
    }
}
