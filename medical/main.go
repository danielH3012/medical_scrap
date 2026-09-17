package main

import (
	"fmt"
	"log"
	"medical/controller"
	"net/http"
	"os"
)

func main() {
	http.HandleFunc("/api/transcribe", controller.NewSpeechController().HandleTranscribe)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	fmt.Printf("Medical scrap berjalan di http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
