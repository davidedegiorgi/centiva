<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class BulkTransactionControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_unauthenticated_bulk_import_returns_401(): void
    {
        $this->postJson('/api/v1/transactions/bulk')->assertUnauthorized();
    }

    public function test_valid_reviewed_rows_are_created_atomically_and_return_201(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/transactions/bulk', [
            'transactions' => [
                $this->row('csv', 'Spesa importata', 45.60),
                $this->row('ocr', 'Scontrino importato', 18.20),
            ],
        ]);

        $response
            ->assertCreated()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.source', 'csv')
            ->assertJsonPath('data.1.source', 'ocr');

        $this->assertDatabaseCount('transactions', 2);
        $this->assertDatabaseHas('transactions', [
            'user_id' => $user->id,
            'description' => 'Spesa importata',
            'currency' => 'EUR',
        ]);
    }

    public function test_invalid_row_returns_422_without_creating_partial_import(): void
    {
        $user = User::factory()->create();
        $invalidRow = $this->row('ocr', 'Importo non valido', 0);

        $response = $this->actingAs($user)->postJson('/api/v1/transactions/bulk', [
            'transactions' => [
                $this->row('csv', 'Riga valida', 12.50),
                $invalidRow,
            ],
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['transactions.1.amount'])
            ->assertJsonFragment(['Ogni importo deve essere maggiore di zero.']);

        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_unexpected_user_id_cannot_change_import_ownership(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $row = [
            ...$this->row('csv', 'Movimento personale', 20),
            'user_id' => $otherUser->id,
        ];

        $this->actingAs($user)->postJson('/api/v1/transactions/bulk', [
            'transactions' => [$row],
        ])->assertCreated();

        $this->assertDatabaseHas('transactions', [
            'user_id' => $user->id,
            'description' => 'Movimento personale',
        ]);
        $this->assertDatabaseMissing('transactions', [
            'user_id' => $otherUser->id,
        ]);
    }

    /** @return array<string, mixed> */
    private function row(string $source, string $description, float $amount): array
    {
        return [
            'type' => 'expense',
            'amount' => $amount,
            'currency' => 'eur',
            'occurred_on' => '2026-11-03',
            'description' => $description,
            'merchant' => null,
            'category' => null,
            'notes' => null,
            'source' => $source,
        ];
    }
}
