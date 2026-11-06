<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\BulkDeleteTransactionRequest;
use Illuminate\Http\JsonResponse;

class BulkDeleteTransactionController extends Controller
{
    public function __invoke(BulkDeleteTransactionRequest $request): JsonResponse
    {
        $deleted = $request->user()
            ->transactions()
            ->whereIn('id', $request->validated('ids'))
            ->delete();

        return response()->json(['deleted' => $deleted]);
    }
}
