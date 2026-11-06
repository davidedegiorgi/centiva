<?php

namespace Database\Factories;

use App\Models\CategoryBudget;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<CategoryBudget> */
class CategoryBudgetFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'category' => fake()->randomElement(['Spesa', 'Ristorazione', 'Trasporti']),
            'amount' => fake()->randomFloat(2, 50, 1000),
            'currency' => 'EUR',
            'period_month' => now()->startOfMonth(),
        ];
    }
}
