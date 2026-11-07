<?php

namespace App\Notifications\Channels;

use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class BrevoChannel
{
    public function send(object $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toMail')) {
            throw new RuntimeException('La notifica non definisce il contenuto email.');
        }

        // Render preserves pasted quotes and whitespace. Brevo considers them
        // part of the key and responds with a generic 401, so remove only
        // accidental wrappers before making the request.
        $apiKey = trim((string) config('services.brevo.api_key'));
        $apiKey = trim($apiKey, "\"'");
        $apiKey = preg_replace('/^Bearer\s+/i', '', $apiKey) ?? $apiKey;
        if ($apiKey === '') {
            throw new RuntimeException('BREVO_API_KEY non configurata.');
        }

        $mail = $notification->toMail($notifiable);
        $recipients = $this->recipients($notifiable->routeNotificationFor('mail', $notification), $notifiable);
        if ($recipients === []) {
            throw new RuntimeException('La notifica non ha un destinatario email.');
        }

        $response = Http::acceptJson()
            ->withHeaders(['api-key' => $apiKey])
            ->connectTimeout(3)
            ->timeout(8)
            ->post(rtrim((string) config('services.brevo.url'), '/').'/v3/smtp/email', [
                'sender' => [
                    'email' => (string) config('mail.from.address'),
                    'name' => (string) config('mail.from.name'),
                ],
                'to' => $recipients,
                'subject' => (string) $mail->subject,
                'htmlContent' => $mail->render()->toHtml(),
            ]);

        if ($response->failed()) {
            Log::warning('Brevo ha rifiutato l’invio dell’email transazionale.', [
                'status' => $response->status(),
                'response' => $response->json(),
            ]);

            $response->throw();
        }
    }

    /** @return array<int, array{email: string, name?: string}> */
    private function recipients(mixed $route, object $notifiable): array
    {
        if (is_string($route) && $route !== '') {
            $name = trim((string) ($notifiable->name ?? ''));

            return [array_filter(['email' => $route, 'name' => $name])];
        }

        if (! is_array($route)) {
            return [];
        }

        $recipients = [];
        foreach ($route as $email => $name) {
            if (is_int($email)) {
                $recipients[] = ['email' => (string) $name];
                continue;
            }

            $recipients[] = array_filter(['email' => (string) $email, 'name' => (string) $name]);
        }

        return $recipients;
    }
}
