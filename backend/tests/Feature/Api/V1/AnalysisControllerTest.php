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
            ->assertJsonPath('data.sample_size', 0);
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
            ->assertJsonCount(1, 'data.duplicates')
            ->assertJsonCount(2, 'data.duplicates.0.transactions')
            ->assertJsonCount(1, 'data.anomalies')
            ->assertJsonPath('data.anomalies.0.transaction.merchant', 'Spesa eccezionale');
        $this->assertNotEmpty($response->json('data.insights'));
    }
}
