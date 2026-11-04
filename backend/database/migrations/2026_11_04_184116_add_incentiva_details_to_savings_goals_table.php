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
        Schema::table('savings_goals', function (Blueprint $table) {
            $table->string('icon', 30)->default('target')->after('name');
            $table->string('saving_frequency', 20)->nullable()->after('target_date');
            $table->string('progress_unit', 20)->default('currency')->after('saving_frequency');
            $table->string('challenge_template', 50)->nullable()->after('progress_unit');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('savings_goals', function (Blueprint $table) {
            $table->dropColumn([
                'icon',
                'saving_frequency',
                'progress_unit',
                'challenge_template',
            ]);
        });
    }
};
