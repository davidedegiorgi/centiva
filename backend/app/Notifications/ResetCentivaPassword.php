<?php

namespace App\Notifications;

use App\Notifications\Channels\BrevoChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class ResetCentivaPassword extends Notification
{
    use Queueable;

    public function __construct(private readonly string $token) {}

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
        $broker = (string) config('auth.defaults.passwords', 'users');
        $expiresInMinutes = (int) config("auth.passwords.{$broker}.expire", 60);
        $resetUrl = rtrim((string) config('app.frontend_url'), '/').'?'.http_build_query([
            'reset_token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);

        return (new MailMessage)
            ->subject('Reimposta la password di Centiva')
            ->markdown('mail.auth.reset-password', [
                'firstName' => Str::before(trim((string) $notifiable->name), ' '),
                'resetUrl' => $resetUrl,
                'expiresInMinutes' => $expiresInMinutes,
            ]);
    }
}
