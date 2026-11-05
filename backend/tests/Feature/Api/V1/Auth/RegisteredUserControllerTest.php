<?php

namespace Tests\Feature\Api\V1\Auth;

use App\Models\User;
use App\Notifications\WelcomeToCentiva;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class RegisteredUserControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withHeader('Origin', 'http://localhost:5173');
    }

    public function test_valid_payload_creates_user_authenticates_session_and_returns_201(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Giulia Bianchi',
            'email' => 'giulia@example.com',
            'password' => 'SecurePass1!',
            'password_confirmation' => 'SecurePass1!',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.name', 'Giulia Bianchi')
            ->assertJsonPath('data.email', 'giulia@example.com')
            ->assertJsonMissingPath('data.password');

        $user = User::query()->where('email', 'giulia@example.com')->firstOrFail();

        $this->assertAuthenticatedAs($user);
        $this->assertModelExists($user);
        $this->assertNotSame('SecurePass1!', $user->password);
        Notification::assertSentTo($user, WelcomeToCentiva::class);
    }

    public function test_empty_payload_returns_422_with_required_field_messages(): void
    {
        $response = $this->postJson('/api/v1/auth/register');

        $response
            ->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'Il nome è obbligatorio.')
            ->assertJsonPath('errors.email.0', "L'indirizzo email è obbligatorio.")
            ->assertJsonValidationErrors(['password']);

        $this->assertDatabaseCount('users', 0);
    }

    public function test_duplicate_email_returns_422_and_does_not_create_user(): void
    {
        User::factory()->create(['email' => 'existing@example.com']);

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Secondo Utente',
            'email' => 'existing@example.com',
            'password' => 'SecurePass1!',
            'password_confirmation' => 'SecurePass1!',
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonPath(
                'errors.email.0',
                'Esiste già un account con questo indirizzo email.',
            );

        $this->assertDatabaseCount('users', 1);
    }

    public function test_unexpected_payload_key_cannot_verify_email(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Giulia Bianchi',
            'email' => 'giulia@example.com',
            'password' => 'SecurePass1!',
            'password_confirmation' => 'SecurePass1!',
            'email_verified_at' => now()->toISOString(),
        ]);

        $response->assertCreated();

        $this->assertDatabaseHas('users', [
            'email' => 'giulia@example.com',
            'email_verified_at' => null,
        ]);
    }
}
