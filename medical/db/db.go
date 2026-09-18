package db

import (
	"fmt"
	"log"
	"medical/model"
	"os"

	"github.com/lib/pq"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() (*gorm.DB, error) {
	host := os.Getenv("DB_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("DB_PORT")
	if port == "" {
		port = "5432"
	}
	user := os.Getenv("DB_USER")
	if user == "" {
		user = "postgres"
	}
	pass := os.Getenv("DB_PASSWORD")
	if pass == "" {
		pass = "postgres"
	}
	dbname := os.Getenv("DB_NAME")
	if dbname == "" {
		dbname = "medical"
	}
	ssl := os.Getenv("DB_SSLMODE")
	if ssl == "" {
		ssl = "disable"
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=Asia/Jakarta",
		host, user, pass, dbname, port, ssl)

	database, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("gagal terhubung ke database postgres: %w", err)
	}

	DB = database
	log.Printf("[Database] Terhubung ke PostgreSQL: %s:%s/%s", host, port, dbname)

	seedInitialData()

	return DB, nil
}

func seedInitialData() {
	// 1. Seed user if empty
	var userCount int64
	DB.Model(&model.User{}).Count(&userCount)
	if userCount == 0 {
		defaultUsers := []model.User{
			{Nama: "admin", Password: "password", Quota: 30},
			{Nama: "Master Admin", Password: "demo", Quota: 30},
		}
		for _, u := range defaultUsers {
			DB.Create(&u)
		}
		log.Println("[Database Seed] Akun user awal dibuat (admin / password)")
	} else {
		// Pastikan quota tidak NULL pada user yang sudah ada
		DB.Model(&model.User{}).Where("quota IS NULL").Update("quota", 30)
	}

	// 2. Seed patients if empty
	var patientCount int64
	DB.Model(&model.Pasien{}).Count(&patientCount)
	if patientCount == 0 {
		defaultPatients := []model.Pasien{
			{NoRM: "RM-2026-0001", Name: "Andi Wijaya", NIK: "3201010101900001", DOB: "1990-01-01", Allergies: pq.StringArray{"Amoxicillin"}},
			{NoRM: "RM-2026-0002", Name: "Siti Rahayu", NIK: "", DOB: "2025-03-15", Allergies: pq.StringArray{}},
			{NoRM: "RM-2026-0003", Name: "Budi Hartono", NIK: "3201072308780002", DOB: "1978-08-23", Allergies: pq.StringArray{}},
		}
		for _, p := range defaultPatients {
			DB.Create(&p)
		}
		log.Println("[Database Seed] Data pasien awal dibuat")
	}

	// 3. Seed consultations if empty
	var consultCount int64
	DB.Model(&model.Consultation{}).Count(&consultCount)
	if consultCount == 0 {
		c1 := model.Consultation{
			PatientID: 1,
			Status:    "Draft Ready",
			StartedAt: "2026-09-17 09:12",
		}
		c1.SetSOAP(model.SOAPDTO{
			Subjective: "Mengeluh nyeri tenggorokan sejak 3 hari, disertai demam ringan.",
			Objective:  "Tonsil hiperemis, tidak ada eksudat. Suhu 37.8°C.",
			Assessment: "Faringitis akut.",
			Plan:       "Terapi simtomatik; edukasi hidrasi.",
		})
		c1.SetPrescription([]model.PrescriptionDTO{
			{Drug: "Paracetamol 500mg", Dosage: "1 tablet", Qty: 10},
		})
		DB.Create(&c1)

		c2 := model.Consultation{
			PatientID: 2,
			Status:    "Sync Failed",
			StartedAt: "2026-09-17 08:45",
		}
		c2.SetSOAP(model.SOAPDTO{
			Subjective: "Ibu melaporkan bayi demam sejak semalam.",
			Objective:  "Suhu 38.2°C, gizi baik, turgor normal.",
			Assessment: "Demam pada bayi.",
			Plan:       "Terapi antipiretik sesuai berat badan.",
		})
		c2.SetPrescription([]model.PrescriptionDTO{
			{Drug: "Paracetamol sirup 120mg/5ml", Dosage: "3.5 ml", Qty: 2},
		})
		DB.Create(&c2)

		c3 := model.Consultation{
			PatientID: 3,
			Status:    "In Progress",
			StartedAt: "2026-09-17 10:05",
		}
		c3.SetSOAP(model.SOAPDTO{})
		c3.SetPrescription([]model.PrescriptionDTO{})
		DB.Create(&c3)

		// Synced history
		h1 := model.Consultation{
			PatientID: 1,
			Status:    "Synced",
			StartedAt: "2026-09-10 14:00",
		}
		h1.SetSOAP(model.SOAPDTO{
			Subjective: "Kontrol rutin hipertensi.",
			Objective:  "TD 130/85 mmHg.",
			Assessment: "Hipertensi terkontrol.",
			Plan:       "Lanjut obat, kontrol 1 bulan.",
		})
		h1.SetPrescription([]model.PrescriptionDTO{
			{Drug: "Amlodipin 5mg", Dosage: "1 tablet", Qty: 30},
		})
		DB.Create(&h1)

		log.Println("[Database Seed] Data konsultasi awal dibuat")
	}
}
