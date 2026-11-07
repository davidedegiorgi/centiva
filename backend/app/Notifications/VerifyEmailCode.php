<?php

namespace App\Notifications;

use App\Notifications\Channels\BrevoChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class VerifyEmailCode extends Notification
{
    use Queueable;

    public function __construct(
        private readonly string $code,
        private readonly int $expiresInMinutes,
    ) {}

    public function via(object $notifiable): array
    {
        return [BrevoChannel::class];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Il tuo codice di verifica Centiva')
            ->markdown('mail.account.verify-email', [
                'firstName' => Str::before(trim((string) $notifiable->name), ' '),
                'code' => $this->code,
                'expiresInMinutes' => $this->expiresInMinutes,
            ]);
    }
}
