<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\BulkStoreTransactionRequest;
use App\Http\Resources\Api\V1\TransactionResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class BulkTransactionController extends Controller
{
    public function __invoke(BulkStoreTransactionRequest $request): JsonResponse
    {
        $transactions = DB::transaction(function () use ($request) {
            return collect($request->validated('transactions'))
                ->map(fn (array $attributes) => $request->user()
                    ->transactions()
                    ->create($attributes));
        });

        return TransactionResource::collection($transactions)
            ->response()
            ->setStatusCode(201);
    }
}
