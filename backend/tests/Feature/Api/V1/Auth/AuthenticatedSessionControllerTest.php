<?php

namespace Tests\Feature\Api\V1\Auth;

use App\Models\User;
use App\Notifications\WelcomeToCentiva;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AuthenticatedSessionControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withHeader('Origin', 'http://localhost:5173');
    }

    public function test_valid_credentials_authenticate_session_and_return_user(): void
    {
        $user = User::factory()->create([
            'email' => 'mario@example.com',
            'password' => 'SecurePass1!',
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'mario@example.com',
            'password' => 'SecurePass1!',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.email', 'mario@example.com');

        $this->assertAuthenticatedAs($user);
    }

    public function test_invalid_credentials_return_422_without_authenticating(): void
    {
        User::factory()->create([
            'email' => 'mario@example.com',
            'password' => 'SecurePass1!',
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'mario@example.com',
            'password' => 'WrongPassword1!',
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'Le credenziali non sono corrette.');

        $this->assertGuest();
    }

    public function test_login_retries_welcome_until_brevo_accepts_it(): void
    {
        Notification::fake();
        $user = User::factory()->create([
            'email' => 'welcome@example.com',
            'password' => 'SecurePass1!',
            'welcome_email_sent_at' => null,
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'welcome@example.com',
            'password' => 'SecurePass1!',
        ])->assertOk();

        Notification::assertSentTo($user, WelcomeToCentiva::class);
        $this->assertNotNull($user->refresh()->welcome_email_sent_at);
    }

    public function test_login_does_not_send_a_duplicate_welcome(): void
    {
        Notification::fake();
        $user = User::factory()->create([
            'email' => 'welcomed@example.com',
            'password' => 'SecurePass1!',
            'welcome_email_sent_at' => now(),
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'welcomed@example.com',
            'password' => 'SecurePass1!',
        ])->assertOk();

        Notification::assertNothingSent();
    }

    public function test_unverified_user_must_confirm_email_before_login(): void
    {
        User::factory()->unverified()->create([
            'email' => 'mario@example.com',
            'password' => 'SecurePass1!',
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'mario@example.com',
            'password' => 'SecurePass1!',
        ])->assertForbidden()
            ->assertJsonPath('code', 'email_verification_required');

        $this->assertGuest();
    }

    public function test_sixth_failed_login_for_same_email_and_ip_returns_429(): void
    {
        User::factory()->create(['email' => 'mario@example.com']);

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->postJson('/api/v1/auth/login', [
                'email' => 'mario@example.com',
                'password' => 'WrongPassword1!',
            ])->assertUnprocessable();
        }

        $this->postJson('/api/v1/auth/login', [
            'email' => 'mario@example.com',
            'password' => 'WrongPassword1!',
        ])->assertTooManyRequests();
    }

    public function test_authenticated_user_can_logout_and_session_becomes_guest(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/auth/logout');

        $response->assertNoContent();
        $this->assertGuest('web');
    }

    public function test_unauthenticated_logout_returns_401(): void
    {
        $this->postJson('/api/v1/auth/logout')->assertUnauthorized();
    }
}
