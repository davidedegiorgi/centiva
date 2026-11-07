<?php

namespace App\Notifications;

use App\Notifications\Channels\BrevoChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class WelcomeToCentiva extends Notification
{
    use Queueable;

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return [BrevoChannel::class];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $firstName = Str::before(trim((string) $notifiable->name), ' ');

        return (new MailMessage)
            ->subject("Benvenuto in Centiva, {$firstName}")
            ->markdown('mail.account.welcome', [
                'firstName' => $firstName,
                'centivaUrl' => rtrim((string) config('app.frontend_url'), '/'),
            ]);
    }
}
