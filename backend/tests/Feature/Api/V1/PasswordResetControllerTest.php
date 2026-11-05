<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use App\Notifications\ResetCentivaPassword;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_known_email_receives_reset_notification(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'mario@example.com']);

        $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'mario@example.com',
        ])->assertOk()->assertJsonPath(
            'message',
            'Se esiste un account associato, riceverai un link per reimpostare la password.',
        );

        Notification::assertSentTo($user, ResetCentivaPassword::class);
    }

    public function test_unknown_email_receives_same_response_without_notification(): void
    {
        Notification::fake();

        $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'unknown@example.com',
        ])->assertOk()->assertJsonPath(
            'message',
            'Se esiste un account associato, riceverai un link per reimpostare la password.',
        );

        Notification::assertNothingSent();
    }

    public function test_valid_token_updates_password_and_invalidates_remember_token(): void
    {
        $user = User::factory()->create([
            'email' => 'mario@example.com',
            'remember_token' => 'old-token',
        ]);
        $token = Password::broker()->createToken($user);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'email' => 'mario@example.com',
            'password' => 'NuovaPassword!2026',
            'password_confirmation' => 'NuovaPassword!2026',
        ])->assertOk()->assertJsonPath(
            'message',
            'Password aggiornata. Ora puoi accedere con le nuove credenziali.',
        );

        $user->refresh();
        $this->assertTrue(Hash::check('NuovaPassword!2026', $user->password));
        $this->assertNotSame('old-token', $user->remember_token);
    }

    public function test_invalid_token_is_rejected(): void
    {
        User::factory()->create(['email' => 'mario@example.com']);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => 'invalid-token',
            'email' => 'mario@example.com',
            'password' => 'NuovaPassword!2026',
            'password_confirmation' => 'NuovaPassword!2026',
        ])->assertUnprocessable()->assertJsonPath(
            'errors.email.0',
            'Il link è scaduto o non è valido. Richiedine uno nuovo.',
        );
    }
}
