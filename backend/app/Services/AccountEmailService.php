<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\AccountDeleted;
use App\Notifications\WelcomeToCentiva;
use Closure;
use Illuminate\Support\Facades\Notification;
use Throwable;

class AccountEmailService
{
    public function sendWelcome(User $user): void
    {
        $this->sendSafely(fn () => $user->notify(new WelcomeToCentiva));
    }

    public function sendDeletionConfirmation(string $email, string $name): void
    {
        $deletedAt = now()
            ->timezone((string) config('app.timezone'))
            ->format('d/m/Y \a\l\l\e H:i');

        $this->sendSafely(fn () => Notification::route('mail', [$email => $name])
            ->notify(new AccountDeleted($name, $deletedAt)));
    }

    private function sendSafely(Closure $send): void
    {
        try {
            $send();
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
