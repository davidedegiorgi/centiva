<?php

namespace Tests\Feature\Api\V1\Auth;

use App\Models\EmailVerificationCode;
use App\Models\User;
use App\Notifications\VerifyEmailCode;
use App\Notifications\WelcomeToCentiva;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class EmailVerificationControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://localhost:5173');
    }

    public function test_valid_code_verifies_email_authenticates_and_sends_welcome(): void
    {
        Notification::fake();
        $user = User::factory()->unverified()->create(['email' => 'verify@example.com']);
        $this->codeFor($user, '123456');

        $this->postJson('/api/v1/auth/verify-email', [
            'email' => $user->email,
            'code' => '123456',
        ])->assertOk()->assertJsonPath('data.email_verified_at', fn (mixed $value): bool => is_string($value));

        $this->assertAuthenticatedAs($user);
        $this->assertNotNull($user->refresh()->email_verified_at);
        $this->assertDatabaseMissing('email_verification_codes', ['user_id' => $user->id]);
        Notification::assertSentTo($user, WelcomeToCentiva::class);
    }

    public function test_wrong_code_is_rejected_and_counts_an_attempt(): void
    {
        $user = User::factory()->unverified()->create();
        $this->codeFor($user, '123456');

        $this->postJson('/api/v1/auth/verify-email', [
            'email' => $user->email,
            'code' => '654321',
        ])->assertUnprocessable()->assertJsonValidationErrors('code');

        $this->assertGuest();
        $this->assertDatabaseHas('email_verification_codes', ['user_id' => $user->id, 'attempts' => 1]);
        $this->assertNull($user->refresh()->email_verified_at);
    }

    public function test_expired_code_is_rejected(): void
    {
        $user = User::factory()->unverified()->create();
        $this->codeFor($user, '123456', now()->subMinute());

        $this->postJson('/api/v1/auth/verify-email', [
            'email' => $user->email,
            'code' => '123456',
        ])->assertUnprocessable()->assertJsonPath('errors.code.0', 'Il codice è scaduto. Richiedine uno nuovo.');

        $this->assertGuest();
    }

    public function test_resend_replaces_code_and_sends_a_new_email(): void
    {
        Notification::fake();
        $user = User::factory()->unverified()->create();

        $this->postJson('/api/v1/auth/resend-verification', ['email' => $user->email])
            ->assertOk()
            ->assertJsonStructure(['message']);

        $this->assertDatabaseHas('email_verification_codes', ['user_id' => $user->id, 'attempts' => 0]);
        Notification::assertSentTo($user, VerifyEmailCode::class);
    }

    private function codeFor(User $user, string $code, mixed $expiresAt = null): void
    {
        EmailVerificationCode::query()->create([
            'user_id' => $user->id,
            'code_hash' => Hash::make($code),
            'attempts' => 0,
            'expires_at' => $expiresAt ?? now()->addMinutes(10),
            'last_sent_at' => now(),
        ]);
    }
}
