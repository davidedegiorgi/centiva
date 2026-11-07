<?php

namespace Tests\Feature\Notifications;

use App\Models\User;
use App\Notifications\Channels\BrevoChannel;
use App\Notifications\VerifyEmailCode;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BrevoChannelTest extends TestCase
{
    public function test_channel_sends_transactional_email_over_https_api(): void
    {
        config()->set('services.brevo.api_key', 'test-api-key');
        config()->set('services.brevo.url', 'https://api.brevo.com');
        config()->set('mail.from.address', 'degiorgidavide79@gmail.com');
        config()->set('mail.from.name', 'Centiva');
        Http::fake(['api.brevo.com/v3/smtp/email' => Http::response(['messageId' => 'test-id'], 201)]);

        $user = User::factory()->make(['name' => 'Giulia Bianchi', 'email' => 'giulia@example.com']);
        (new BrevoChannel)->send($user, new VerifyEmailCode('123456', 10));

        Http::assertSent(fn (Request $request): bool => $request->url() === 'https://api.brevo.com/v3/smtp/email'
            && $request->hasHeader('api-key', 'test-api-key')
            && $request['sender']['email'] === 'degiorgidavide79@gmail.com'
            && $request['to'][0]['email'] === 'giulia@example.com'
            && str_contains($request['htmlContent'], '123456'));
    }

    public function test_channel_normalizes_api_key_wrappers(): void
    {
        config()->set('services.brevo.api_key', '  "xkeysib-test"  ');
        config()->set('services.brevo.url', 'https://api.brevo.com');
        Http::fake(['api.brevo.com/v3/smtp/email' => Http::response(['messageId' => 'test-id'], 201)]);

        (new BrevoChannel)->send(
            User::factory()->make(['email' => 'giulia@example.com']),
            new VerifyEmailCode('123456', 10),
        );

        Http::assertSent(fn (Request $request): bool => $request->hasHeader('api-key', 'xkeysib-test'));
    }
}
