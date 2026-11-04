<?php

namespace Database\Factories;

use App\Enums\SavingsFrequency;
use App\Enums\SavingsGoalKind;
use App\Enums\SavingsGoalStatus;
use App\Enums\SavingsProgressUnit;
use App\Models\SavingsGoal;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SavingsGoal>
 */
class SavingsGoalFactory extends Factory
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
            'kind' => SavingsGoalKind::Goal,
            'name' => fake()->words(3, true),
            'icon' => 'target',
            'target_amount' => fake()->randomFloat(2, 100, 10000),
            'currency' => 'EUR',
            'target_date' => fake()->optional()->dateTimeBetween('+1 month', '+1 year'),
            'saving_frequency' => SavingsFrequency::Monthly,
            'progress_unit' => SavingsProgressUnit::Currency,
            'challenge_template' => null,
            'status' => SavingsGoalStatus::Active,
        ];
    }
}
