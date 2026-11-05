<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AccountEmailService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Throwable;

class GoogleAuthController extends Controller
{
    public function redirect(): RedirectResponse
    {
        if (! $this->isConfigured()) {
            return $this->frontendRedirect('Accesso con Google non ancora configurato.');
        }

        return Socialite::driver('google')
            ->scopes(['openid', 'email', 'profile'])
            ->redirect();
    }

    public function callback(
        Request $request,
        AccountEmailService $accountEmailService,
    ): RedirectResponse {
        if (! $this->isConfigured()) {
            return $this->frontendRedirect('Accesso con Google non ancora configurato.');
        }

        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (Throwable $exception) {
            report($exception);

            return $this->frontendRedirect('Google non ha completato l’accesso. Riprova.');
        }

        $googleId = trim((string) $googleUser->getId());
        $email = Str::lower(trim((string) $googleUser->getEmail()));
        $isVerified = filter_var(
            $googleUser->user['email_verified'] ?? false,
            FILTER_VALIDATE_BOOL,
        );

        if ($googleId === '' || $email === '' || ! $isVerified) {
            return $this->frontendRedirect('Google non ha fornito un indirizzo email verificato.');
        }

        $userByGoogleId = User::query()->where('google_id', $googleId)->first();
        $userByEmail = User::query()->where('email', $email)->first();

        if ($userByGoogleId && $userByEmail && ! $userByGoogleId->is($userByEmail)) {
            return $this->frontendRedirect('Questo account Google è già collegato a un altro profilo.');
        }

        $user = $userByGoogleId ?? $userByEmail ?? new User;

        if ($user->google_id && $user->google_id !== $googleId) {
            return $this->frontendRedirect('Questa email è già collegata a un altro account Google.');
        }

        $user->name = trim((string) $googleUser->getName()) ?: Str::before($email, '@');
        $user->email = $email;
        $user->google_id = $googleId;
        $user->email_verified_at ??= now();

        $isNewUser = ! $user->exists;

        if ($isNewUser) {
            // Mantiene compatibile il campo password senza creare credenziali utilizzabili.
            $user->password = Str::random(64);
        }

        $user->save();

        Auth::login($user, true);
        $request->session()->regenerate();

        if ($isNewUser) {
            $accountEmailService->sendWelcome($user);
        }

        return redirect()->away($this->frontendUrl().'?auth=google');
    }

    private function isConfigured(): bool
    {
        return filled(config('services.google.client_id'))
            && filled(config('services.google.client_secret'))
            && filled(config('services.google.redirect'));
    }

    private function frontendRedirect(string $message): RedirectResponse
    {
        return redirect()->away($this->frontendUrl().'?'.http_build_query([
            'auth_error' => $message,
        ]));
    }

    private function frontendUrl(): string
    {
        return rtrim((string) config('app.frontend_url', 'http://localhost:5173'), '/');
    }
}
