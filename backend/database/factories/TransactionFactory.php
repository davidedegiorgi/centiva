<?php

namespace Database\Factories;

use App\Enums\TransactionSource;
use App\Enums\TransactionType;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Transaction>
 */
class TransactionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'type' => fake()->randomElement(TransactionType::cases()),
            'amount' => fake()->randomFloat(2, 1, 5000),
            'currency' => 'EUR',
            'occurred_on' => fake()->dateTimeBetween('-1 year', 'now'),
            'description' => fake()->sentence(4),
            'merchant' => fake()->optional()->company(),
            'category' => fake()->optional()->randomElement([
                'Casa',
                'Spesa',
                'Trasporti',
                'Tempo libero',
            ]),
            'notes' => fake()->optional()->sentence(),
            'source' => TransactionSource::Manual,
        ];
    }

    public function income(): static
    {
        return $this->state(fn (): array => ['type' => TransactionType::Income]);
    }

    public function expense(): static
    {
        return $this->state(fn (): array => ['type' => TransactionType::Expense]);
    }
}
