<?php

namespace Tests\Feature\Api\V1;

use App\Models\CategoryBudget;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class CategoryBudgetControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_category_budgets_require_authentication(): void
    {
        $this->getJson('/api/v1/category-budgets')->assertUnauthorized();
        $this->postJson('/api/v1/category-budgets')->assertUnauthorized();
    }

    public function test_user_can_create_and_update_a_monthly_category_budget(): void
    {
        $user = User::factory()->create();
        $payload = ['category' => 'Spesa', 'amount' => 400, 'currency' => 'eur', 'month' => '2026-11'];

        $this->actingAs($user)->postJson('/api/v1/category-budgets', $payload)
            ->assertCreated()
            ->assertJsonPath('data.amount', '400.00')
            ->assertJsonPath('data.currency', 'EUR');

        $this->actingAs($user)->postJson('/api/v1/category-budgets', [...$payload, 'amount' => 475.50])
            ->assertOk()
            ->assertJsonPath('data.amount', '475.50');

        $this->assertDatabaseCount('category_budgets', 1);
        $this->assertDatabaseHas('category_budgets', [
            'user_id' => $user->id,
            'category' => 'Spesa',
            'amount' => 475.50,
        ]);
        $this->assertSame('2026-11-01', CategoryBudget::query()->firstOrFail()->period_month->toDateString());
    }

    public function test_index_calculates_spending_from_real_owned_expenses_in_selected_month(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        CategoryBudget::factory()->for($user)->create([
            'category' => 'Spesa', 'amount' => 200, 'period_month' => '2026-11-01',
        ]);
        CategoryBudget::factory()->for($user)->create([
            'category' => 'Trasporti', 'amount' => 100, 'period_month' => '2026-11-01',
        ]);
        Transaction::factory()->expense()->for($user)->create([
            'category' => 'Spesa', 'amount' => 170, 'occurred_on' => '2026-11-05',
        ]);
        Transaction::factory()->expense()->for($user)->create([
            'category' => 'Trasporti', 'amount' => 125, 'occurred_on' => '2026-11-10',
        ]);
        Transaction::factory()->income()->for($user)->create([
            'category' => 'Spesa', 'amount' => 999, 'occurred_on' => '2026-11-11',
        ]);
        Transaction::factory()->expense()->for($user)->create([
            'category' => 'Spesa', 'amount' => 999, 'occurred_on' => '2026-10-31',
        ]);
        Transaction::factory()->expense()->for($otherUser)->create([
            'category' => 'Spesa', 'amount' => 999, 'occurred_on' => '2026-11-05',
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/category-budgets?month=2026-11&currency=eur');

        $response->assertOk()
            ->assertJsonPath('data.total_budget', '300.00')
            ->assertJsonPath('data.total_spent', '295.00')
            ->assertJsonPath('data.total_remaining', '5.00')
            ->assertJsonPath('data.items.0.category', 'Spesa')
            ->assertJsonPath('data.items.0.status', 'warning')
            ->assertJsonPath('data.items.1.category', 'Trasporti')
            ->assertJsonPath('data.items.1.remaining', '-25.00')
            ->assertJsonPath('data.items.1.status', 'exceeded');
    }

    public function test_user_can_delete_only_an_owned_budget(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $budget = CategoryBudget::factory()->for($user)->create();
        $otherBudget = CategoryBudget::factory()->for($otherUser)->create();

        $this->actingAs($user)->deleteJson("/api/v1/category-budgets/{$budget->id}")
            ->assertNoContent();
        $this->assertModelMissing($budget);

        $this->actingAs($user)->deleteJson("/api/v1/category-budgets/{$otherBudget->id}")
            ->assertNotFound();
        $this->assertModelExists($otherBudget);
    }
}
