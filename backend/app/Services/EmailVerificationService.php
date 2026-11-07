<?php

namespace App\Services;

use App\Models\EmailVerificationCode;
use App\Models\User;
use App\Notifications\VerifyEmailCode;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class EmailVerificationService
{
    public const EXPIRATION_MINUTES = 10;

    private const MAX_ATTEMPTS = 5;

    public function issue(User $user): void
    {
        $code = (string) random_int(100000, 999999);

        EmailVerificationCode::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'code_hash' => Hash::make($code),
                'attempts' => 0,
                'expires_at' => now()->addMinutes(self::EXPIRATION_MINUTES),
                'last_sent_at' => now(),
            ],
        );

        $user->notify(new VerifyEmailCode($code, self::EXPIRATION_MINUTES));
    }

    public function verify(User $user, string $code): void
    {
        $error = DB::transaction(function () use ($user, $code): ?string {
            $verification = EmailVerificationCode::query()
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();

            if ($verification === null || $verification->expires_at->isPast()) {
                return 'Il codice è scaduto. Richiedine uno nuovo.';
            }

            if ($verification->attempts >= self::MAX_ATTEMPTS) {
                return 'Hai superato il numero massimo di tentativi. Richiedi un nuovo codice.';
            }

            if (! Hash::check($code, $verification->code_hash)) {
                $verification->increment('attempts');

                return 'Il codice inserito non è corretto.';
            }

            $user->forceFill(['email_verified_at' => now()])->save();
            $verification->delete();

            return null;
        });

        if ($error !== null) {
            throw ValidationException::withMessages(['code' => $error]);
        }
    }
}
