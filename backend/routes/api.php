<?php

use App\Http\Controllers\Api\V1\AnalysisController;
use App\Http\Controllers\Api\V1\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Api\V1\Auth\EmailVerificationController;
use App\Http\Controllers\Api\V1\Auth\PasswordResetController;
use App\Http\Controllers\Api\V1\Auth\RegisteredUserController;
use App\Http\Controllers\Api\V1\BulkDeleteTransactionController;
use App\Http\Controllers\Api\V1\BulkTransactionController;
use App\Http\Controllers\Api\V1\CategoryBudgetController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\GoalContributionController;
use App\Http\Controllers\Api\V1\PlanningController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\SavingsGoalController;
use App\Http\Controllers\Api\V1\TransactionController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('api.v1.')->group(function (): void {
    Route::prefix('auth')->name('auth.')->group(function (): void {
        Route::post('/register', RegisteredUserController::class)
            ->middleware('throttle:register')
            ->name('register');

        Route::post('/login', [AuthenticatedSessionController::class, 'store'])
            ->middleware('throttle:login')
            ->name('login');

        Route::post('/verify-email', [EmailVerificationController::class, 'store'])
            ->middleware('throttle:verify-email')
            ->name('email.verify');

        Route::post('/resend-verification', [EmailVerificationController::class, 'resend'])
            ->middleware('throttle:resend-verification')
            ->name('email.resend');

        Route::post('/forgot-password', [PasswordResetController::class, 'store'])
            ->middleware('throttle:forgot-password')
            ->name('password.email');

        Route::post('/reset-password', [PasswordResetController::class, 'update'])
            ->middleware('throttle:reset-password')
            ->name('password.update');
    });

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/dashboard', DashboardController::class)->name('dashboard');
        Route::get('/analysis', AnalysisController::class)->name('analysis');
        Route::get('/planning', PlanningController::class)->name('planning');
        Route::apiResource('category-budgets', CategoryBudgetController::class)
            ->only(['index', 'store', 'destroy'])
            ->parameters(['category-budgets' => 'categoryBudget']);
        Route::post('/savings-goals/{savingsGoal}/contributions', GoalContributionController::class)
            ->name('savings-goals.contributions.store');
        Route::apiResource('savings-goals', SavingsGoalController::class)
            ->parameters(['savings-goals' => 'savingsGoal']);
        Route::post('/auth/logout', [AuthenticatedSessionController::class, 'destroy'])
            ->name('auth.logout');
        Route::get('/profile', [ProfileController::class, 'show'])->name('profile.show');
        Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
        Route::delete('/profile', [ProfileController::class, 'destroy'])
            ->middleware('throttle:3,1')
            ->name('profile.destroy');
        Route::post('/transactions/bulk', BulkTransactionController::class)
            ->name('transactions.bulk');
        Route::delete('/transactions/bulk', BulkDeleteTransactionController::class)
            ->name('transactions.bulk-destroy');
        Route::apiResource('transactions', TransactionController::class);
    });
});
