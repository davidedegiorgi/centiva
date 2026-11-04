<?php

namespace Tests\Feature\Api\V1;

use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class PlanningControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_planning_requires_authentication(): void
    {
        $this->getJson('/api/v1/planning')->assertUnauthorized();
    }

    public function test_empty_history_returns_current_balance_without_inventing_subscriptions(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/v1/planning')->assertOk()
            ->assertJsonPath('data.future_balance.current_balance', '0.00')
            ->assertJsonPath('data.future_balance.projected_balance', '0.00')
            ->assertJsonPath('data.future_balance.confidence', 'low')
            ->assertJsonCount(0, 'data.subscriptions');
    }

    public function test_future_balance_and_monthly_subscriptions_are_calculated_from_user_history(): void
    {
        $this->travelTo('2026-11-20 12:00:00');
        $user = User::factory()->create();
        $other = User::factory()->create();
        Transaction::factory()->income()->for($user)->create(['amount' => 2000, 'occurred_on' => '2026-11-01']);
        Transaction::factory()->expense()->for($user)->create(['amount' => 500, 'occurred_on' => '2026-11-10']);
        foreach (['2026-09-05', '2026-10-05', '2026-11-05'] as $date) {
            Transaction::factory()->expense()->for($user)->create([
                'amount' => 9.99, 'occurred_on' => $date, 'merchant' => 'Stream Plus',
            ]);
        }
        Transaction::factory()->expense()->for($other)->count(3)->create(['amount' => 99, 'merchant' => 'Segreto']);

        $response = $this->actingAs($user)->getJson('/api/v1/planning?currency=eur');

        $response->assertOk()->assertJsonPath('data.currency', 'EUR')
            ->assertJsonPath('data.future_balance.current_balance', '1470.03')
            ->assertJsonPath('data.future_balance.days_remaining', 10)
            ->assertJsonCount(1, 'data.subscriptions')
            ->assertJsonPath('data.subscriptions.0.label', 'Stream Plus')
            ->assertJsonPath('data.subscriptions.0.frequency', 'monthly')
            ->assertJsonPath('data.subscriptions.0.average_amount', '9.99')
            ->assertJsonPath('data.subscriptions.0.next_expected_on', '2026-12-06');
    }
}
