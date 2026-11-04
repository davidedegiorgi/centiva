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
        Schema::create('goal_contributions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('savings_goal_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 14, 2);
            $table->date('contributed_on');
            $table->string('notes', 500)->nullable();
            $table->timestamps();

            $table->index(['savings_goal_id', 'contributed_on']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('goal_contributions');
    }
};
