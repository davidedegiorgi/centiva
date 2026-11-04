<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\SavingsGoalStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreGoalContributionRequest;
use App\Http\Resources\Api\V1\SavingsGoalResource;
use App\Models\SavingsGoal;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class GoalContributionController extends Controller
{
    public function __invoke(StoreGoalContributionRequest $request, SavingsGoal $savingsGoal): JsonResponse
    {
        $goal = DB::transaction(function () use ($request, $savingsGoal): SavingsGoal {
            $lockedGoal = SavingsGoal::query()->whereKey($savingsGoal->getKey())->lockForUpdate()->firstOrFail();
            $lockedGoal->contributions()->create($request->validated());

            if ((float) $lockedGoal->contributions()->sum('amount') >= (float) $lockedGoal->target_amount) {
                $lockedGoal->update(['status' => SavingsGoalStatus::Completed]);
            }

            return $lockedGoal;
        });

        return (new SavingsGoalResource($goal->loadSum('contributions', 'amount')->load(['contributions' => fn ($query) => $query->latest('contributed_on')])))->response()->setStatusCode(201);
    }
}
