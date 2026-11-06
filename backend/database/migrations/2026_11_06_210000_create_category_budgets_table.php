<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('category_budgets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('category', 100);
            $table->decimal('amount', 14, 2);
            $table->char('currency', 3)->default('EUR');
            $table->date('period_month');
            $table->timestampsTz();

            $table->unique(['user_id', 'category', 'currency', 'period_month']);
            $table->index(['user_id', 'period_month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('category_budgets');
    }
};
