<?php

namespace Tests\Feature\Api\V1;

use App\Enums\SavingsGoalStatus;
use App\Models\GoalContribution;
use App\Models\SavingsGoal;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class SavingsGoalControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_goals_require_authentication(): void
    {
        $this->getJson('/api/v1/savings-goals')->assertUnauthorized();
        $this->postJson('/api/v1/savings-goals')->assertUnauthorized();
    }

    public function test_user_can_create_and_list_only_personal_goals(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        SavingsGoal::factory()->for($other)->create(['name' => 'Obiettivo altrui']);

        $created = $this->actingAs($user)->postJson('/api/v1/savings-goals', [
            'kind' => 'challenge',
            'name' => 'Challenge trenta giorni',
            'target_amount' => 300,
            'currency' => 'eur',
            'target_date' => '2026-12-31',
        ]);

        $created->assertCreated()->assertJsonPath('data.kind', 'challenge')
            ->assertJsonPath('data.name', 'Challenge trenta giorni')
            ->assertJsonPath('data.currency', 'EUR')
            ->assertJsonPath('data.current_amount', '0.00')
            ->assertJsonPath('data.progress_percentage', 0);

        $this->actingAs($user)->getJson('/api/v1/savings-goals')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonMissing(['name' => 'Obiettivo altrui']);
    }

    public function test_contribution_updates_progress_and_completes_goal_atomically(): void
    {
        $user = User::factory()->create();
        $goal = SavingsGoal::factory()->for($user)->create(['target_amount' => 100]);
        GoalContribution::factory()->for($goal, 'savingsGoal')->create(['amount' => 40]);

        $response = $this->actingAs($user)->postJson("/api/v1/savings-goals/{$goal->id}/contributions", [
            'amount' => 60,
            'contributed_on' => '2026-11-03',
            'notes' => 'Accantonamento mensile',
        ]);

        $response->assertCreated()->assertJsonPath('data.current_amount', '100.00')
            ->assertJsonPath('data.progress_percentage', 100)
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonCount(2, 'data.contributions');
        $this->assertDatabaseHas('savings_goals', ['id' => $goal->id, 'status' => SavingsGoalStatus::Completed->value]);
    }

    public function test_other_users_goal_is_not_accessible(): void
    {
        $user = User::factory()->create();
        $goal = SavingsGoal::factory()->create();

        $this->actingAs($user)->getJson("/api/v1/savings-goals/{$goal->id}")->assertNotFound();
        $this->actingAs($user)->deleteJson("/api/v1/savings-goals/{$goal->id}")->assertNotFound();
    }
}
