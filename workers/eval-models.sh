#!/bin/bash
# Model evaluation script - runs all 3 models against diagnostic images

API_URL="https://hf4a-card-scanner.github-f2b.workers.dev/scan"
IMAGES_DIR="/tmp/hf4a-diag/images"
RESULTS_DIR="/tmp/hf4a-eval"
mkdir -p "$RESULTS_DIR"

# Models to test
MODELS=("nano" "mini" "full")  # maps to gpt-5-nano, gpt-5-mini, gpt-5

# Also test gpt-4o-mini and gpt-4.1-mini by updating worker

for img in "$IMAGES_DIR"/*.jpg; do
    filename=$(basename "$img")
    echo "Processing: $filename"

    # Base64 encode the image
    IMG_B64=$(base64 -i "$img")

    for model in "${MODELS[@]}"; do
        echo "  Model: $model"
        output_file="$RESULTS_DIR/${filename%.jpg}-${model}.json"

        # Time the request
        start_time=$(python3 -c "import time; print(time.time())")

        curl -s -X POST "$API_URL" \
            -H "Content-Type: application/json" \
            -d "{\"image\": \"data:image/jpeg;base64,${IMG_B64}\", \"model\": \"${model}\"}" \
            > "$output_file"

        end_time=$(python3 -c "import time; print(time.time())")

        # Add timing to results
        latency=$(python3 -c "print(round(($end_time - $start_time) * 1000))")
        echo "    Latency: ${latency}ms"
    done
done

echo "Results saved to $RESULTS_DIR"
