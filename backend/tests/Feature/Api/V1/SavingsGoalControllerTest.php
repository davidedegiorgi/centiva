<?php

namespace Tests\Feature\Api\V1;

use App\Enums\SavingsGoalStatus;
use App\Models\GoalContribution;
use App\Models\SavingsGoal;
use App\Models\User;
use Carbon\CarbonImmutable;
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
            'icon' => 'sparkles',
            'target_amount' => 300,
            'currency' => 'eur',
            'target_date' => '2026-12-31',
            'saving_frequency' => 'weekly',
            'progress_unit' => 'currency',
            'challenge_template' => 'weekly_20',
        ]);

        $created->assertCreated()->assertJsonPath('data.kind', 'challenge')
            ->assertJsonPath('data.name', 'Challenge trenta giorni')
            ->assertJsonPath('data.currency', 'EUR')
            ->assertJsonPath('data.icon', 'sparkles')
            ->assertJsonPath('data.saving_frequency', 'weekly')
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
        $this->actingAs($user)->postJson("/api/v1/savings-goals/{$goal->id}/contributions", [
            'amount' => 10,
            'contributed_on' => '2026-11-04',
        ])->assertNotFound();
    }

    public function test_goal_returns_automatic_plan_and_progress_badges(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-11-04 10:00:00'));
        $user = User::factory()->create();

        $created = $this->actingAs($user)->postJson('/api/v1/savings-goals', [
            'kind' => 'goal',
            'name' => 'Fondo emergenze',
            'icon' => 'shield',
            'target_amount' => 120,
            'currency' => 'EUR',
            'target_date' => '2026-12-02',
            'saving_frequency' => 'weekly',
            'progress_unit' => 'currency',
        ])->assertCreated()
            ->assertJsonPath('data.plan.recommended_amount', '30.00')
            ->assertJsonPath('data.plan.remaining_periods', 4)
            ->assertJsonPath('data.plan.pace_status', 'on_track')
            ->assertJsonCount(0, 'data.badges');

        $goalId = $created->json('data.id');

        $this->actingAs($user)->postJson("/api/v1/savings-goals/{$goalId}/contributions", [
            'amount' => 30,
            'contributed_on' => '2026-11-04',
            'notes' => 'Primo passo',
        ])->assertCreated()
            ->assertJsonPath('data.progress_percentage', 25)
            ->assertJsonPath('data.badges.0.key', 'first_contribution')
            ->assertJsonPath('data.badges.1.key', 'progress_25');
    }

    public function test_no_spend_challenge_accepts_only_one_confirmation_per_day(): void
    {
        $user = User::factory()->create();
        $goal = SavingsGoal::factory()->for($user)->create([
            'kind' => 'challenge',
            'target_amount' => 3,
            'progress_unit' => 'days',
            'saving_frequency' => null,
            'challenge_template' => 'no_spend_3_days',
        ]);

        $payload = ['amount' => 1, 'contributed_on' => '2026-11-04', 'notes' => 'Giornata confermata'];

        $this->actingAs($user)->postJson("/api/v1/savings-goals/{$goal->id}/contributions", $payload)
            ->assertCreated()->assertJsonPath('data.current_amount', '1.00');

        $this->actingAs($user)->postJson("/api/v1/savings-goals/{$goal->id}/contributions", $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('contributed_on');
    }

    public function test_no_spend_challenge_rejects_multiple_days_in_one_confirmation(): void
    {
        $user = User::factory()->create();
        $goal = SavingsGoal::factory()->for($user)->create([
            'kind' => 'challenge',
            'target_amount' => 3,
            'progress_unit' => 'days',
            'saving_frequency' => null,
        ]);

        $this->actingAs($user)->postJson("/api/v1/savings-goals/{$goal->id}/contributions", [
            'amount' => 2,
            'contributed_on' => '2026-11-04',
        ])->assertUnprocessable()->assertJsonValidationErrors('amount');
    }
}
