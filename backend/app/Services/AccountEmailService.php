<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\AccountDeleted;
use App\Notifications\WelcomeToCentiva;
use Illuminate\Support\Facades\Notification;

class AccountEmailService
{
    public function sendWelcome(User $user): void
    {
        if ($user->welcome_email_sent_at !== null) {
            return;
        }

        $user->notify(new WelcomeToCentiva);
        $user->forceFill(['welcome_email_sent_at' => now()])->save();
    }

    public function sendDeletionConfirmation(string $email, string $name): void
    {
        $deletedAt = now()
            ->timezone((string) config('app.timezone'))
            ->format('d/m/Y \a\l\l\e H:i');

        Notification::route('mail', [$email => $name])
            ->notify(new AccountDeleted($name, $deletedAt));
    }
}
