<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 16);
            $table->decimal('amount', 14, 2);
            $table->char('currency', 3)->default('EUR');
            $table->date('occurred_on');
            $table->string('description');
            $table->string('merchant', 160)->nullable();
            $table->string('category', 100)->nullable();
            $table->text('notes')->nullable();
            $table->string('source', 16)->default('manual');
            $table->timestampsTz();

            $table->index(['user_id', 'occurred_on']);
            $table->index(['user_id', 'type', 'occurred_on']);
            $table->index(['user_id', 'category']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
