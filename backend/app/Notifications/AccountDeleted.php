<?php

namespace App\Notifications;

use App\Notifications\Channels\BrevoChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class AccountDeleted extends Notification
{
    use Queueable;

    public function __construct(
        private readonly string $name,
        private readonly string $deletedAt,
    ) {}

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
        return (new MailMessage)
            ->subject('Il tuo account Centiva è stato eliminato')
            ->markdown('mail.account.deleted', [
                'firstName' => Str::before(trim($this->name), ' '),
                'deletedAt' => $this->deletedAt,
            ]);
    }
}
