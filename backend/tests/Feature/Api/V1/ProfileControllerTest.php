<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class ProfileControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_unauthenticated_profile_request_returns_401(): void
    {
        $this->getJson('/api/v1/profile')->assertUnauthorized();
    }

    public function test_authenticated_user_receives_only_public_profile_fields(): void
    {
        $user = User::factory()->create([
            'name' => 'Mario Rossi',
            'email' => 'mario@example.com',
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/profile');

        $response
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.name', 'Mario Rossi')
            ->assertJsonPath('data.email', 'mario@example.com')
            ->assertJsonMissingPath('data.password')
            ->assertJsonMissingPath('data.remember_token');
    }

    public function test_valid_payload_updates_authenticated_user_profile(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->patchJson('/api/v1/profile', [
            'name' => 'Nome Aggiornato',
            'email' => 'aggiornato@example.com',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.name', 'Nome Aggiornato')
            ->assertJsonPath('data.email', 'aggiornato@example.com');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Nome Aggiornato',
            'email' => 'aggiornato@example.com',
        ]);
    }

    public function test_email_owned_by_another_user_returns_422_without_updating_profile(): void
    {
        $user = User::factory()->create([
            'name' => 'Mario Rossi',
            'email' => 'mario@example.com',
        ]);
        User::factory()->create(['email' => 'existing@example.com']);

        $response = $this->actingAs($user)->patchJson('/api/v1/profile', [
            'name' => 'Mario Rossi',
            'email' => 'existing@example.com',
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonPath(
                'errors.email.0',
                'Esiste già un account con questo indirizzo email.',
            );

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'email' => 'mario@example.com',
        ]);
    }
}
