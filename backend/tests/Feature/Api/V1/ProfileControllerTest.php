<?php

namespace Tests\Feature\Api\V1;

use App\Models\GoalContribution;
use App\Models\SavingsGoal;
use App\Models\Transaction;
use App\Models\User;
use App\Notifications\AccountDeleted;
use App\Notifications\Channels\BrevoChannel;
use App\Services\AccountEmailService;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class ProfileControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_unauthenticated_profile_request_returns_401(): void
    {
        $this->getJson('/api/v1/profile')->assertUnauthorized();
    }

    public function test_authenticated_user_receives_only_public_profile_fields(): void
    {
        $user = User::factory()->create([
            'name' => 'Mario Rossi',
            'email' => 'mario@example.com',
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/profile');

        $response
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.name', 'Mario Rossi')
            ->assertJsonPath('data.email', 'mario@example.com')
            ->assertJsonMissingPath('data.password')
            ->assertJsonMissingPath('data.remember_token');
    }

    public function test_valid_payload_updates_authenticated_user_profile(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->patchJson('/api/v1/profile', [
            'name' => 'Nome Aggiornato',
            'email' => 'aggiornato@example.com',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.name', 'Nome Aggiornato')
            ->assertJsonPath('data.email', 'aggiornato@example.com');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Nome Aggiornato',
            'email' => 'aggiornato@example.com',
        ]);
    }

    public function test_email_owned_by_another_user_returns_422_without_updating_profile(): void
    {
        $user = User::factory()->create([
            'name' => 'Mario Rossi',
            'email' => 'mario@example.com',
        ]);
        User::factory()->create(['email' => 'existing@example.com']);

        $response = $this->actingAs($user)->patchJson('/api/v1/profile', [
            'name' => 'Mario Rossi',
            'email' => 'existing@example.com',
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonPath(
                'errors.email.0',
                'Esiste già un account con questo indirizzo email.',
            );

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'email' => 'mario@example.com',
        ]);
    }

    public function test_unauthenticated_user_cannot_delete_an_account(): void
    {
        $this->deleteJson('/api/v1/profile', [
            'confirmation' => 'ELIMINA',
        ])->assertUnauthorized();
    }

    public function test_wrong_confirmation_does_not_delete_account_data(): void
    {
        $user = User::factory()->create();
        $transaction = Transaction::factory()->for($user)->create();

        $this->actingAs($user)
            ->deleteJson('/api/v1/profile', ['confirmation' => 'elimina'])
            ->assertUnprocessable()
            ->assertJsonPath(
                'errors.confirmation.0',
                'La parola di conferma deve essere ELIMINA.',
            );

        $this->assertDatabaseHas('users', ['id' => $user->id]);
        $this->assertDatabaseHas('transactions', ['id' => $transaction->id]);
    }

    public function test_user_can_permanently_delete_account_and_owned_data(): void
    {
        Notification::fake();

        $user = User::factory()->create(['email' => 'delete@example.com']);
        $otherUser = User::factory()->create();
        $transaction = Transaction::factory()->for($user)->create();
        $goal = SavingsGoal::factory()->for($user)->create();
        $contribution = GoalContribution::factory()->for($goal)->create();
        $otherTransaction = Transaction::factory()->for($otherUser)->create();

        DB::table('password_reset_tokens')->insert([
            'email' => $user->email,
            'token' => 'hashed-token',
            'created_at' => now(),
        ]);

        $this->actingAs($user)
            ->withSession([])
            ->deleteJson('/api/v1/profile', ['confirmation' => 'ELIMINA'])
            ->assertNoContent();

        $this->assertGuest();
        $this->assertDatabaseMissing('users', ['id' => $user->id]);
        $this->assertDatabaseMissing('transactions', ['id' => $transaction->id]);
        $this->assertDatabaseMissing('savings_goals', ['id' => $goal->id]);
        $this->assertDatabaseMissing('goal_contributions', ['id' => $contribution->id]);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);

        $this->assertDatabaseHas('users', ['id' => $otherUser->id]);
        $this->assertDatabaseHas('transactions', ['id' => $otherTransaction->id]);

        Notification::assertSentOnDemand(
            AccountDeleted::class,
            fn (AccountDeleted $notification, array $channels, object $notifiable): bool => $channels === [BrevoChannel::class]
                && $notifiable->routes['mail'] === [$user->email => $user->name],
        );
    }

    public function test_account_is_not_deleted_when_confirmation_email_fails(): void
    {
        $user = User::factory()->create(['email' => 'keep@example.com']);

        $this->mock(AccountEmailService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('sendDeletionConfirmation')
                ->once()
                ->andThrow(new RuntimeException('Brevo non disponibile'));
        });

        $this->actingAs($user)
            ->withSession([])
            ->deleteJson('/api/v1/profile', ['confirmation' => 'ELIMINA'])
            ->assertServiceUnavailable()
            ->assertJsonPath('code', 'account_deletion_email_failed');

        $this->assertAuthenticatedAs($user);
        $this->assertDatabaseHas('users', ['id' => $user->id]);
    }
}
