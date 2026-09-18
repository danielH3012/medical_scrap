package model

import (
	"encoding/json"

	"github.com/lib/pq"
)

type Pasien struct {
	ID        uint           `gorm:"primaryKey;column:id" json:"id"`
	NoRM      string         `gorm:"column:noRM" json:"noRM"`
	Name      string         `gorm:"column:name" json:"name"`
	NIK       string         `gorm:"column:nik" json:"nik"`
	DOB       string         `gorm:"column:dob" json:"dob"`
	Allergies pq.StringArray `gorm:"column:allergies;type:text[]" json:"allergies"`
	UserID    uint           `gorm:"column:user_id" json:"userId"`
}

func (Pasien) TableName() string {
	return "pasien"
}

type User struct {
	ID       uint   `gorm:"primaryKey;column:id" json:"id"`
	Nama     string `gorm:"column:nama" json:"nama"`
	Password string `gorm:"column:password" json:"-"`
	Quota    int64  `gorm:"column:quota" json:"quota"`
}

func (User) TableName() string {
	return "user"
}

type Consultation struct {
	ID           uint           `gorm:"primaryKey;column:id" json:"id"`
	PatientID    uint           `gorm:"column:patientId" json:"patientId"`
	Status       string         `gorm:"column:status" json:"status"`
	StartedAt    string         `gorm:"column:startedAt" json:"startedAt"`
	SOAP         pq.StringArray `gorm:"column:soap;type:text[]" json:"-"`
	Prescription pq.StringArray `gorm:"column:prescription;type:text[]" json:"-"`
	UserID       uint           `gorm:"column:user_id" json:"userId"`
}

func (Consultation) TableName() string {
	return "consultations"
}

type SOAPDTO struct {
	Subjective string `json:"subjective"`
	Objective  string `json:"objective"`
	Assessment string `json:"assessment"`
	Plan       string `json:"plan"`
}

type PrescriptionDTO struct {
	Drug   string `json:"drug"`
	Dosage string `json:"dosage"`
	Qty    any    `json:"qty"`
}

type ConsultationResponse struct {
	ID           uint              `json:"id"`
	PatientID    uint              `json:"patientId"`
	Status       string            `json:"status"`
	StartedAt    string            `json:"startedAt"`
	SOAP         SOAPDTO           `json:"soap"`
	Prescription []PrescriptionDTO `json:"prescription"`
	UserID       uint              `json:"userId"`
}

func (c *Consultation) ToResponse() ConsultationResponse {
	soap := SOAPDTO{}
	if len(c.SOAP) > 0 {
		soap.Subjective = c.SOAP[0]
	}
	if len(c.SOAP) > 1 {
		soap.Objective = c.SOAP[1]
	}
	if len(c.SOAP) > 2 {
		soap.Assessment = c.SOAP[2]
	}
	if len(c.SOAP) > 3 {
		soap.Plan = c.SOAP[3]
	}

	rxList := make([]PrescriptionDTO, 0)
	for _, rawRx := range c.Prescription {
		var item PrescriptionDTO
		if err := json.Unmarshal([]byte(rawRx), &item); err == nil && item.Drug != "" {
			rxList = append(rxList, item)
		} else if rawRx != "" {
			rxList = append(rxList, PrescriptionDTO{
				Drug:   rawRx,
				Dosage: "-",
				Qty:    "-",
			})
		}
	}

	return ConsultationResponse{
		ID:           c.ID,
		PatientID:    c.PatientID,
		Status:       c.Status,
		StartedAt:    c.StartedAt,
		SOAP:         soap,
		Prescription: rxList,
		UserID:       c.UserID,
	}
}

func (c *Consultation) SetSOAP(s SOAPDTO) {
	c.SOAP = pq.StringArray{s.Subjective, s.Objective, s.Assessment, s.Plan}
}

func (c *Consultation) SetPrescription(rx []PrescriptionDTO) {
	arr := make(pq.StringArray, 0, len(rx))
	for _, it := range rx {
		b, err := json.Marshal(it)
		if err == nil {
			arr = append(arr, string(b))
		}
	}
	c.Prescription = arr
}
