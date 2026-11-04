<?php

namespace Tests\Feature\Api\V1;

use App\Enums\TransactionSource;
use App\Enums\TransactionType;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class TransactionControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_unauthenticated_index_request_returns_401(): void
    {
        $this->getJson('/api/v1/transactions')->assertUnauthorized();
    }

    public function test_valid_payload_creates_owned_manual_transaction_and_returns_201(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson(
            '/api/v1/transactions',
            $this->validPayload(),
        );

        $response
            ->assertCreated()
            ->assertJsonPath('data.type', 'expense')
            ->assertJsonPath('data.amount', '125.50')
            ->assertJsonPath('data.currency', 'EUR')
            ->assertJsonPath('data.source', 'manual');

        $transaction = Transaction::query()->firstOrFail();

        $this->assertModelExists($transaction);
        $this->assertSame($user->id, $transaction->user_id);
        $this->assertSame(TransactionSource::Manual, $transaction->source);
    }

    public function test_empty_payload_returns_422_with_required_field_messages(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/transactions');

        $response
            ->assertUnprocessable()
            ->assertJsonPath('errors.type.0', 'Il tipo di transazione è obbligatorio.')
            ->assertJsonPath('errors.amount.0', "L'importo è obbligatorio.")
            ->assertJsonPath('errors.occurred_on.0', 'La data è obbligatoria.')
            ->assertJsonPath('errors.description.0', 'La descrizione è obbligatoria.');

        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_unexpected_user_and_source_keys_cannot_be_assigned(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $payload = [
            ...$this->validPayload(),
            'user_id' => $otherUser->id,
            'source' => 'ocr',
        ];

        $response = $this->actingAs($user)->postJson('/api/v1/transactions', $payload);

        $response
            ->assertCreated()
            ->assertJsonPath('data.source', 'manual');

        $this->assertDatabaseHas('transactions', [
            'user_id' => $user->id,
            'source' => 'manual',
        ]);
        $this->assertDatabaseMissing('transactions', [
            'user_id' => $otherUser->id,
        ]);
    }

    public function test_index_returns_only_authenticated_users_transactions_in_date_order(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $older = Transaction::factory()->for($user)->create([
            'occurred_on' => '2026-09-10',
            'description' => 'Movimento precedente',
        ]);
        $newer = Transaction::factory()->for($user)->create([
            'occurred_on' => '2026-10-10',
            'description' => 'Movimento recente',
        ]);
        Transaction::factory()->for($otherUser)->create([
            'occurred_on' => '2026-11-01',
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/transactions');

        $response
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $newer->id)
            ->assertJsonPath('data.1.id', $older->id)
            ->assertJsonPath('meta.total', 2);
    }

    public function test_index_filters_search_type_category_date_and_amount(): void
    {
        $user = User::factory()->create();
        $matching = Transaction::factory()->expense()->for($user)->create([
            'amount' => 42.50,
            'occurred_on' => '2026-10-15',
            'description' => 'Spesa settimanale',
            'merchant' => 'Mercato Centrale',
            'category' => 'Spesa',
        ]);
        Transaction::factory()->income()->for($user)->create([
            'amount' => 42.50,
            'occurred_on' => '2026-10-15',
            'description' => 'Rimborso mercato',
            'category' => 'Spesa',
        ]);
        Transaction::factory()->expense()->for($user)->create([
            'amount' => 240,
            'occurred_on' => '2026-10-15',
            'description' => 'Mercato artigianale',
            'category' => 'Spesa',
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/transactions?'.http_build_query([
            'search' => 'centrale',
            'type' => 'expense',
            'category' => 'Spesa',
            'date_from' => '2026-10-01',
            'date_to' => '2026-10-31',
            'amount_min' => 40,
            'amount_max' => 50,
        ]));

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $matching->id);
    }

    public function test_invalid_sort_column_returns_422_without_executing_dynamic_order(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson(
            '/api/v1/transactions?sort=id%20desc%3Bdrop%20table%20users',
        );

        $response
            ->assertUnprocessable()
            ->assertJsonPath('errors.sort.0', 'Il campo di ordinamento non è valido.');
    }

    public function test_user_can_show_own_transaction(): void
    {
        $user = User::factory()->create();
        $transaction = Transaction::factory()->for($user)->create();

        $response = $this->actingAs($user)->getJson("/api/v1/transactions/{$transaction->id}");

        $response
            ->assertOk()
            ->assertJsonPath('data.id', $transaction->id);
    }

    public function test_transaction_owned_by_another_user_returns_404(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $transaction = Transaction::factory()->for($otherUser)->create();

        $this->actingAs($user)
            ->getJson("/api/v1/transactions/{$transaction->id}")
            ->assertNotFound();
    }

    public function test_valid_payload_updates_owned_transaction_without_changing_ownership_or_source(): void
    {
        $user = User::factory()->create();
        $transaction = Transaction::factory()->for($user)->create([
            'source' => TransactionSource::Csv,
        ]);
        $payload = [
            ...$this->validPayload(),
            'description' => 'Descrizione aggiornata',
            'amount' => 89.90,
        ];

        $response = $this->actingAs($user)->patchJson(
            "/api/v1/transactions/{$transaction->id}",
            $payload,
        );

        $response
            ->assertOk()
            ->assertJsonPath('data.description', 'Descrizione aggiornata')
            ->assertJsonPath('data.amount', '89.90')
            ->assertJsonPath('data.source', 'csv');

        $this->assertDatabaseHas('transactions', [
            'id' => $transaction->id,
            'user_id' => $user->id,
            'description' => 'Descrizione aggiornata',
            'source' => 'csv',
        ]);
    }

    public function test_user_can_delete_own_transaction(): void
    {
        $user = User::factory()->create();
        $transaction = Transaction::factory()->for($user)->create();

        $response = $this->actingAs($user)->deleteJson(
            "/api/v1/transactions/{$transaction->id}",
        );

        $response->assertNoContent();
        $this->assertModelMissing($transaction);
    }

    /** @return array<string, mixed> */
    private function validPayload(): array
    {
        return [
            'type' => TransactionType::Expense->value,
            'amount' => 125.50,
            'currency' => 'eur',
            'occurred_on' => '2026-10-20',
            'description' => 'Spesa alimentare',
            'merchant' => 'Mercato Centrale',
            'category' => 'Spesa',
            'notes' => 'Acquisto settimanale',
        ];
    }
}
