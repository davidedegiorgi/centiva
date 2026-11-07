<?php

namespace App\Providers;

use App\Models\CategoryBudget;
use App\Models\SavingsGoal;
use App\Models\Transaction;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Model::preventLazyLoading(! $this->app->isProduction());

        Route::bind('transaction', function (string $value): Transaction {
            $user = request()->user();

            abort_if($user === null, 401);

            return $user->transactions()->whereKey($value)->firstOrFail();
        });

        Route::bind('savingsGoal', function (string $value): SavingsGoal {
            $user = request()->user();

            abort_if($user === null, 401);

            return $user->savingsGoals()->whereKey($value)->firstOrFail();
        });

        Route::bind('categoryBudget', function (string $value): CategoryBudget {
            $user = request()->user();

            abort_if($user === null, 401);

            return $user->categoryBudgets()->whereKey($value)->firstOrFail();
        });

        RateLimiter::for('login', function (Request $request): Limit {
            $email = Str::transliterate(Str::lower($request->string('email')->toString()));

            return Limit::perMinute(5)->by($email.'|'.$request->ip());
        });

        RateLimiter::for('register', fn (Request $request): Limit => Limit::perMinute(3)
            ->by($request->ip()));

        RateLimiter::for('verify-email', function (Request $request): Limit {
            $email = Str::transliterate(Str::lower($request->string('email')->toString()));

            return Limit::perMinute(10)->by($email.'|'.$request->ip());
        });

        RateLimiter::for('resend-verification', function (Request $request): Limit {
            $email = Str::transliterate(Str::lower($request->string('email')->toString()));

            return Limit::perMinute(2)->by($email.'|'.$request->ip());
        });

        RateLimiter::for('forgot-password', function (Request $request): Limit {
            $email = Str::transliterate(Str::lower($request->string('email')->toString()));

            return Limit::perMinute(3)->by($email.'|'.$request->ip());
        });

        RateLimiter::for('reset-password', fn (Request $request): Limit => Limit::perMinute(5)
            ->by($request->ip()));
    }
}
