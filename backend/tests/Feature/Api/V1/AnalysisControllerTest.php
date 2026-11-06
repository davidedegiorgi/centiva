<?php

namespace Tests\Feature\Api\V1;

use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class AnalysisControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_analysis_requires_authentication(): void
    {
        $this->getJson('/api/v1/analysis')->assertUnauthorized();
    }

    public function test_empty_analysis_contains_no_generated_findings(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/v1/analysis')
            ->assertOk()->assertJsonCount(0, 'data.insights')
            ->assertJsonCount(0, 'data.duplicates')->assertJsonCount(0, 'data.anomalies')
            ->assertJsonPath('data.sample_size', 0)
            ->assertJsonPath('data.summary.current_expenses', '0.00')
            ->assertJsonPath('data.summary.change_percentage', null)
            ->assertJsonCount(0, 'data.categories')
            ->assertJsonPath('data.status.insights', 'insufficient')
            ->assertJsonPath('data.status.duplicates', 'insufficient')
            ->assertJsonPath('data.status.anomalies', 'insufficient');
    }

    public function test_uncategorized_expenses_do_not_generate_category_advice(): void
    {
        $this->travelTo('2026-11-20 12:00:00');
        $user = User::factory()->create();
        Transaction::factory()->expense()->for($user)->count(3)->create([
            'occurred_on' => '2026-11-10',
            'category' => null,
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/analysis');

        $response->assertOk()
            ->assertJsonCount(0, 'data.insights')
            ->assertJsonPath('data.data_quality.current_categorized_expenses', 0)
            ->assertJsonPath('data.status.insights', 'insufficient');
    }

    public function test_category_insight_is_factual_and_has_no_assumed_saving(): void
    {
        $this->travelTo('2026-11-20 12:00:00');
        $user = User::factory()->create();
        Transaction::factory()->expense()->for($user)->count(3)->create([
            'amount' => 20,
            'occurred_on' => '2026-11-10',
            'category' => 'Spesa',
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/analysis');

        $response->assertOk()
            ->assertJsonPath('data.status.insights', 'ready')
            ->assertJsonPath('data.insights.0.title', 'La categoria principale è Spesa')
            ->assertJsonPath('data.insights.0.potential_saving', '0.00');
    }

    public function test_analysis_returns_real_month_summary_and_category_distribution(): void
    {
        $this->travelTo('2026-11-20 12:00:00');
        $user = User::factory()->create();
        Transaction::factory()->expense()->for($user)->create([
            'amount' => 60,
            'occurred_on' => '2026-11-10',
            'category' => 'Spesa',
        ]);
        Transaction::factory()->expense()->for($user)->create([
            'amount' => 40,
            'occurred_on' => '2026-11-12',
            'category' => 'Casa',
        ]);
        Transaction::factory()->expense()->for($user)->create([
            'amount' => 20,
            'occurred_on' => '2026-11-15',
            'category' => null,
        ]);
        Transaction::factory()->expense()->for($user)->create([
            'amount' => 80,
            'occurred_on' => '2026-10-12',
            'category' => 'Spesa',
        ]);

        $this->actingAs($user)->getJson('/api/v1/analysis')
            ->assertOk()
            ->assertJsonPath('data.period.from', '2026-11-01')
            ->assertJsonPath('data.period.to', '2026-11-20')
            ->assertJsonPath('data.summary.current_expenses', '120.00')
            ->assertJsonPath('data.summary.previous_comparable_expenses', '80.00')
            ->assertJsonPath('data.summary.change_percentage', 50)
            ->assertJsonPath('data.summary.categorized_expenses', '100.00')
            ->assertJsonPath('data.summary.category_coverage_percentage', 83.3)
            ->assertJsonCount(2, 'data.categories')
            ->assertJsonPath('data.categories.0.category', 'Spesa')
            ->assertJsonPath('data.categories.0.amount', '60.00')
            ->assertJsonPath('data.categories.0.percentage', 60)
            ->assertJsonPath('data.categories.0.transaction_count', 1);
    }

    public function test_anomaly_status_reports_insufficient_data_below_five_expenses(): void
    {
        $this->travelTo('2026-11-20 12:00:00');
        $user = User::factory()->create();
        Transaction::factory()->expense()->for($user)->count(4)->create([
            'amount' => 20,
            'occurred_on' => '2026-11-10',
        ]);

        $this->actingAs($user)->getJson('/api/v1/analysis')
            ->assertOk()
            ->assertJsonPath('data.status.anomalies', 'insufficient');
    }

    public function test_anomaly_status_reports_a_clear_completed_analysis(): void
    {
        $this->travelTo('2026-11-20 12:00:00');
        $user = User::factory()->create();
        Transaction::factory()->expense()->for($user)->count(5)->create([
            'amount' => 20,
            'occurred_on' => '2026-11-10',
        ]);

        $this->actingAs($user)->getJson('/api/v1/analysis')
            ->assertOk()
            ->assertJsonPath('data.status.anomalies', 'clear');
    }

    public function test_saving_amount_is_the_observed_difference_for_comparable_periods(): void
    {
        $this->travelTo('2026-11-20 12:00:00');
        $user = User::factory()->create();
        Transaction::factory()->expense()->for($user)->count(3)->create([
            'amount' => 20,
            'occurred_on' => '2026-11-10',
            'category' => 'Spesa',
        ]);
        Transaction::factory()->expense()->for($user)->count(3)->create([
            'amount' => 10,
            'occurred_on' => '2026-10-10',
            'category' => 'Spesa',
        ]);
        Transaction::factory()->expense()->for($user)->create([
            'amount' => 500,
            'occurred_on' => '2026-10-25',
            'category' => 'Spesa',
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/analysis');

        $response->assertOk()
            ->assertJsonPath('data.data_quality.previous_comparable_expenses', 3)
            ->assertJsonPath('data.insights.1.potential_saving', '30.00')
            ->assertJsonPath('data.insights.1.message', 'Hai speso il 100% in più rispetto allo stesso periodo del mese scorso.');
    }

    public function test_analysis_uses_only_the_authenticated_users_real_expenses(): void
    {
        $this->travelTo('2026-11-20 12:00:00');
        $user = User::factory()->create();
        $other = User::factory()->create();

        foreach ([20, 25, 30, 35, 40] as $index => $amount) {
            Transaction::factory()->expense()->for($user)->create([
                'amount' => $amount, 'occurred_on' => '2026-11-0'.($index + 1),
                'category' => 'Spesa', 'merchant' => "Negozio {$index}",
            ]);
        }
        Transaction::factory()->expense()->for($user)->count(2)->create([
            'amount' => 19.90, 'occurred_on' => '2026-11-12',
            'merchant' => 'Doppio addebito', 'description' => 'Carta',
        ]);
        Transaction::factory()->expense()->for($user)->create([
            'amount' => 1000, 'occurred_on' => '2026-11-15',
            'merchant' => 'Spesa eccezionale', 'category' => 'Casa',
        ]);
        Transaction::factory()->expense()->for($other)->create(['amount' => 9000, 'occurred_on' => '2026-11-15']);

        $response = $this->actingAs($user)->getJson('/api/v1/analysis?currency=eur');

        $response->assertOk()->assertJsonPath('data.currency', 'EUR')
            ->assertJsonPath('data.sample_size', 8)
            ->assertJsonPath('data.status.insights', 'ready')
            ->assertJsonCount(1, 'data.duplicates')
            ->assertJsonCount(2, 'data.duplicates.0.transactions')
            ->assertJsonCount(1, 'data.anomalies')
            ->assertJsonPath('data.anomalies.0.transaction.merchant', 'Spesa eccezionale');
        $this->assertNotEmpty($response->json('data.insights'));
    }
}
