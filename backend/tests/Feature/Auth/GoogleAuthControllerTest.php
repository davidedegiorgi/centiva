<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Notifications\WelcomeToCentiva;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as GoogleUser;
use Mockery;
use Tests\TestCase;

class GoogleAuthControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set([
            'app.frontend_url' => 'http://localhost:5173',
            'services.google.client_id' => 'client-id',
            'services.google.client_secret' => 'client-secret',
            'services.google.redirect' => 'http://localhost:8000/auth/google/callback',
        ]);
    }

    public function test_google_callback_creates_user_and_authenticates_session(): void
    {
        Notification::fake();

        $googleUser = (new GoogleUser)->setRaw([
            'email_verified' => true,
        ])->map([
            'id' => 'google-123',
            'name' => 'Mario Rossi',
            'email' => 'MARIO@example.com',
        ]);

        $provider = Mockery::mock();
        $provider->shouldReceive('user')->once()->andReturn($googleUser);
        Socialite::shouldReceive('driver')->once()->with('google')->andReturn($provider);

        $this->get('/auth/google/callback')
            ->assertRedirect('http://localhost:5173?auth=google');

        $this->assertAuthenticated();
        $this->assertDatabaseHas('users', [
            'email' => 'mario@example.com',
            'google_id' => 'google-123',
        ]);

        $user = User::query()->where('email', 'mario@example.com')->firstOrFail();
        Notification::assertSentTo($user, WelcomeToCentiva::class);
    }

    public function test_google_callback_links_existing_user_with_same_verified_email(): void
    {
        Notification::fake();

        $user = User::factory()->create(['email' => 'mario@example.com']);
        $googleUser = (new GoogleUser)->setRaw([
            'email_verified' => true,
        ])->map([
            'id' => 'google-456',
            'name' => 'Mario Google',
            'email' => 'mario@example.com',
        ]);

        $provider = Mockery::mock();
        $provider->shouldReceive('user')->once()->andReturn($googleUser);
        Socialite::shouldReceive('driver')->once()->with('google')->andReturn($provider);

        $this->get('/auth/google/callback')->assertRedirect();

        $this->assertAuthenticatedAs($user);
        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'google_id' => 'google-456',
        ]);
        Notification::assertNothingSent();
    }

    public function test_unverified_google_email_is_rejected(): void
    {
        $googleUser = (new GoogleUser)->setRaw([
            'email_verified' => false,
        ])->map([
            'id' => 'google-789',
            'name' => 'Mario Rossi',
            'email' => 'mario@example.com',
        ]);

        $provider = Mockery::mock();
        $provider->shouldReceive('user')->once()->andReturn($googleUser);
        Socialite::shouldReceive('driver')->once()->with('google')->andReturn($provider);

        $this->get('/auth/google/callback')
            ->assertRedirect('http://localhost:5173?auth_error=Google+non+ha+fornito+un+indirizzo+email+verificato.');

        $this->assertGuest();
        $this->assertDatabaseCount('users', 0);
    }

    public function test_missing_google_configuration_returns_to_login(): void
    {
        config()->set('services.google.client_id', null);

        $this->get('/auth/google/redirect')
            ->assertRedirect('http://localhost:5173?auth_error=Accesso+con+Google+non+ancora+configurato.');
    }

    public function test_root_forwards_an_oauth_callback_instead_of_showing_the_laravel_welcome_page(): void
    {
        $googleUser = (new GoogleUser)->setRaw([
            'email_verified' => true,
        ])->map([
            'id' => 'google-root-callback',
            'name' => 'Root Callback',
            'email' => 'root@example.com',
        ]);

        $provider = Mockery::mock();
        $provider->shouldReceive('user')->once()->andReturn($googleUser);
        Socialite::shouldReceive('driver')->once()->with('google')->andReturn($provider);

        $this->get('/?code=oauth-code&state=oauth-state')
            ->assertRedirect('http://localhost:5173?auth=google');
    }
}
