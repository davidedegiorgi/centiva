<?php

namespace Tests\Feature\Api\V1\Auth;

use App\Models\User;
use App\Notifications\VerifyEmailCode;
use App\Services\EmailVerificationService;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class RegisteredUserControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withHeader('Origin', 'http://localhost:5173');
    }

    public function test_valid_payload_creates_unverified_user_and_sends_six_digit_code(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Giulia Bianchi',
            'email' => 'giulia@example.com',
            'password' => 'Aa1!aa',
            'password_confirmation' => 'Aa1!aa',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('email', 'giulia@example.com')
            ->assertJsonPath('verification_required', true);

        $user = User::query()->where('email', 'giulia@example.com')->firstOrFail();

        $this->assertGuest();
        $this->assertModelExists($user);
        $this->assertNotSame('Aa1!aa', $user->password);
        $this->assertNull($user->email_verified_at);
        $this->assertDatabaseHas('email_verification_codes', ['user_id' => $user->id, 'attempts' => 0]);
        Notification::assertSentTo($user, VerifyEmailCode::class);
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

    public function test_password_shorter_than_six_characters_is_rejected(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Giulia Bianchi',
            'email' => 'giulia@example.com',
            'password' => 'Aa1!a',
            'password_confirmation' => 'Aa1!a',
        ])->assertUnprocessable()
            ->assertJsonPath('errors.password.0', 'La password deve contenere almeno 6 caratteri.');

        $this->assertDatabaseMissing('users', ['email' => 'giulia@example.com']);
    }

    public function test_password_still_requires_mixed_case_number_and_symbol(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Giulia Bianchi',
            'email' => 'giulia@example.com',
            'password' => 'abcdef',
            'password_confirmation' => 'abcdef',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('password');

        $this->assertDatabaseMissing('users', ['email' => 'giulia@example.com']);
    }

    public function test_email_delivery_failure_returns_503_without_leaving_an_incomplete_user(): void
    {
        $verificationService = Mockery::mock(EmailVerificationService::class);
        $verificationService->shouldReceive('issue')->once()->andReturnUsing(function (): never {
            $this->assertSame(0, DB::transactionLevel());

            throw new RuntimeException('SMTP unavailable');
        });
        $this->app->instance(EmailVerificationService::class, $verificationService);

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Giulia Bianchi',
            'email' => 'giulia@example.com',
            'password' => 'SecurePass1!',
            'password_confirmation' => 'SecurePass1!',
        ])->assertServiceUnavailable()
            ->assertJsonPath('code', 'verification_email_delivery_failed');

        $this->assertDatabaseMissing('users', ['email' => 'giulia@example.com']);
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

    public function test_unverified_email_can_restart_registration_and_receive_a_new_code(): void
    {
        Notification::fake();
        $user = User::factory()->unverified()->create([
            'name' => 'Nome precedente',
            'email' => 'pending@example.com',
        ]);

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Nome aggiornato',
            'email' => 'pending@example.com',
            'password' => 'NewSecurePass1!',
            'password_confirmation' => 'NewSecurePass1!',
        ])->assertCreated()
            ->assertJsonPath('verification_required', true);

        $this->assertDatabaseCount('users', 1);
        $this->assertSame('Nome aggiornato', $user->refresh()->name);
        $this->assertDatabaseHas('email_verification_codes', ['user_id' => $user->id]);
        Notification::assertSentTo($user, VerifyEmailCode::class);
    }

    public function test_unexpected_payload_key_cannot_verify_email(): void
    {
        Notification::fake();

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
