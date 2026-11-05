<?php

namespace Tests\Feature\Notifications;

use App\Models\User;
use App\Notifications\AccountDeleted;
use App\Notifications\ResetCentivaPassword;
use App\Notifications\WelcomeToCentiva;
use Illuminate\Notifications\AnonymousNotifiable;
use Tests\TestCase;

class AccountNotificationTest extends TestCase
{
    public function test_welcome_email_contains_centiva_onboarding_content(): void
    {
        config()->set('app.frontend_url', 'https://centiva.vercel.app');
        $user = User::factory()->make(['name' => 'Giulia Bianchi']);

        $mail = (new WelcomeToCentiva)->toMail($user);
        $html = $mail->render()->toHtml();

        $this->assertSame('Benvenuto in Centiva, Giulia', $mail->subject);
        $this->assertSame('https://centiva.vercel.app', $mail->viewData['centivaUrl']);
        $this->assertStringContainsString('il tuo account è pronto', $html);
        $this->assertStringContainsString('Apri Centiva', $html);
    }

    public function test_password_reset_email_contains_secure_real_reset_url(): void
    {
        config()->set('app.frontend_url', 'https://centiva.vercel.app');
        $user = User::factory()->make([
            'name' => 'Mario Rossi',
            'email' => 'mario@example.com',
        ]);

        $mail = (new ResetCentivaPassword('reset-token'))->toMail($user);
        $html = $mail->render()->toHtml();

        $this->assertSame('Reimposta la password di Centiva', $mail->subject);
        $this->assertSame(
            'https://centiva.vercel.app?reset_token=reset-token&email=mario%40example.com',
            $mail->viewData['resetUrl'],
        );
        $this->assertStringContainsString('scadrà tra', $html);
        $this->assertStringContainsString('Se non hai richiesto tu il recupero', $html);
    }

    public function test_deleted_account_email_confirms_irreversible_data_removal(): void
    {
        $notification = new AccountDeleted('Mario Rossi', '05/11/2026 alle 10:45');

        $mail = $notification->toMail(new AnonymousNotifiable);
        $html = $mail->render()->toHtml();

        $this->assertSame('Il tuo account Centiva è stato eliminato', $mail->subject);
        $this->assertStringContainsString('05/11/2026 alle 10:45', $html);
        $this->assertStringContainsString('Queste informazioni non possono essere recuperate', $html);
    }
}
