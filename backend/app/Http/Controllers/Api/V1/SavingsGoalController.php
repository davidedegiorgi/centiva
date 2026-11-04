<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\SavingsGoalStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreSavingsGoalRequest;
use App\Http\Requests\Api\V1\UpdateSavingsGoalRequest;
use App\Http\Resources\Api\V1\SavingsGoalResource;
use App\Models\SavingsGoal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class SavingsGoalController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $goals = request()->user()->savingsGoals()
            ->withSum('contributions', 'amount')
            ->with(['contributions' => fn ($query) => $query->latest('contributed_on')->limit(10)])
            ->orderByRaw("case when status = 'active' then 0 else 1 end")
            ->orderBy('target_date')->orderByDesc('created_at')->get();

        return SavingsGoalResource::collection($goals);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreSavingsGoalRequest $request): JsonResponse
    {
        $goal = $request->user()->savingsGoals()->create([
            ...$request->validated(),
            'status' => SavingsGoalStatus::Active,
        ]);

        return (new SavingsGoalResource($goal->loadSum('contributions', 'amount')->load('contributions')))
            ->response()->setStatusCode(201);
    }

    /**
     * Display the specified resource.
     */
    public function show(SavingsGoal $savingsGoal): JsonResponse
    {
        return (new SavingsGoalResource($savingsGoal->loadSum('contributions', 'amount')->load(['contributions' => fn ($query) => $query->latest('contributed_on')])))->response();
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateSavingsGoalRequest $request, SavingsGoal $savingsGoal): JsonResponse
    {
        $savingsGoal->update($request->validated());
        $saved = (float) $savingsGoal->contributions()->sum('amount');
        $status = $saved >= (float) $savingsGoal->target_amount
            ? SavingsGoalStatus::Completed
            : SavingsGoalStatus::Active;
        $savingsGoal->update(['status' => $status]);

        return (new SavingsGoalResource($savingsGoal->refresh()->loadSum('contributions', 'amount')->load('contributions')))->response();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(SavingsGoal $savingsGoal): Response
    {
        $savingsGoal->delete();

        return response()->noContent();
    }
}
