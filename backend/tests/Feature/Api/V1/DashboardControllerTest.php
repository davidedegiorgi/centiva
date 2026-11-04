<?php

namespace Tests\Feature\Api\V1;

use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class DashboardControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_unauthenticated_dashboard_request_returns_401(): void
    {
        $this->getJson('/api/v1/dashboard')->assertUnauthorized();
    }

    public function test_empty_dashboard_returns_zero_summary_and_empty_series(): void
    {
        $this->travelTo('2026-11-03 12:00:00');
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/v1/dashboard');

        $response
            ->assertOk()
            ->assertJsonPath('data.currency', 'EUR')
            ->assertJsonPath('data.summary.income', '0')
            ->assertJsonPath('data.summary.expenses', '0')
            ->assertJsonPath('data.summary.net_savings', '0.00')
            ->assertJsonCount(0, 'data.daily')
            ->assertJsonCount(6, 'data.monthly_comparison')
            ->assertJsonCount(0, 'data.categories')
            ->assertJsonCount(0, 'data.recent');
    }

    public function test_dashboard_aggregates_only_users_selected_currency_transactions(): void
    {
        $this->travelTo('2026-11-03 12:00:00');
        $user = User::factory()->create();
        $otherUser = User::factory()->create();

        Transaction::factory()->income()->for($user)->create([
            'amount' => 1000,
            'currency' => 'EUR',
            'occurred_on' => '2026-11-01',
            'description' => 'Stipendio',
        ]);
        Transaction::factory()->expense()->for($user)->create([
            'amount' => 200,
            'currency' => 'EUR',
            'occurred_on' => '2026-11-02',
            'category' => 'Casa',
            'description' => 'Bolletta',
        ]);
        Transaction::factory()->expense()->for($user)->create([
            'amount' => 50,
            'currency' => 'EUR',
            'occurred_on' => '2026-11-02',
            'category' => 'Spesa',
            'description' => 'Supermercato',
        ]);
        Transaction::factory()->expense()->for($user)->create([
            'amount' => 100,
            'currency' => 'EUR',
            'occurred_on' => '2026-10-15',
            'category' => 'Casa',
            'description' => 'Bolletta precedente',
        ]);
        Transaction::factory()->income()->for($user)->create([
            'amount' => 5000,
            'currency' => 'USD',
            'occurred_on' => '2026-11-01',
        ]);
        Transaction::factory()->income()->for($otherUser)->create([
            'amount' => 9000,
            'currency' => 'EUR',
            'occurred_on' => '2026-11-01',
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/dashboard?currency=eur');

        $response
            ->assertOk()
            ->assertJsonPath('data.currency', 'EUR')
            ->assertJsonPath('data.summary.income', '1000')
            ->assertJsonPath('data.summary.expenses', '250')
            ->assertJsonPath('data.summary.net_savings', '750.00')
            ->assertJsonPath('data.summary.previous_month_expenses', '100')
            ->assertJsonPath('data.summary.expense_change_percentage', 150)
            ->assertJsonPath('data.monthly_comparison.4.month', '2026-10')
            ->assertJsonPath('data.monthly_comparison.4.net_savings', '-100.00')
            ->assertJsonPath('data.monthly_comparison.5.month', '2026-11')
            ->assertJsonPath('data.monthly_comparison.5.net_savings', '750.00')
            ->assertJsonCount(2, 'data.daily')
            ->assertJsonPath('data.categories.0.category', 'Casa')
            ->assertJsonPath('data.categories.0.total', '200')
            ->assertJsonCount(4, 'data.recent');
    }
}
