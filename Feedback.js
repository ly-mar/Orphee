import React, { useRef } from 'react';
import { SafeAreaView, ScrollView, View, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Button, Text, RadioButton } from 'react-native-paper';
import { AntDesign } from '@expo/vector-icons';
import Checkbox from 'expo-checkbox';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { db, app } from './firebaseConfig'; // Assuming firebase is configured in this file
import { createAsyncActionLock } from './utils/actionLockUtils';
import { validateFeedbackPayload } from './utils/userAndFeedbackUtils';


// Feedback Form Screen
const FeedbackForm = ({ navigation }) => {
    const [usageFrequency, setUsageFrequency] = React.useState('');
    const [motivation, setMotivation] = React.useState('');
    const [mostUsedFeature, setMostUsedFeature] = React.useState('');
    const [improvementSuggestion, setImprovementSuggestion] = React.useState('');
    const [followUp, setFollowUp] = React.useState(false);
    const [name, setName] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [age, setAge] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [feedbackType, setFeedbackType] = React.useState('comments');
    const [generalFeedback, setGeneralFeedback] = React.useState('');
    const actionLockRef = useRef(createAsyncActionLock());

    const handleSubmit = () => {
      const combinedFeedback = [generalFeedback, improvementSuggestion, motivation]
        .filter(Boolean)
        .join('\n');
      const validation = validateFeedbackPayload(combinedFeedback || generalFeedback || improvementSuggestion);

      if (!validation.ok) {
        Alert.alert('Feedback Required', validation.error);
        return;
      }

      return actionLockRef.current(async () => {
        const feedbackData = {
          usageFrequency: String(usageFrequency || '').slice(0, 200),
          motivation: String(motivation || '').slice(0, 500),
          mostUsedFeature: String(mostUsedFeature || '').slice(0, 200),
          improvementSuggestion: String(improvementSuggestion || '').slice(0, 1000),
          followUp: Boolean(followUp),
          name: String(name || '').trim().slice(0, 100),
          phone: String(phone || '').trim().slice(0, 30),
          age: String(age || '').trim().slice(0, 10),
          email: String(email || '').trim().toLowerCase().slice(0, 100),
          feedbackType,
          generalFeedback: validation.text,
          createdAt: new Date().toISOString(),
        };
        try {
          await addDoc(collection(db, 'feedbacks'), feedbackData);
          Alert.alert('Thank You!', 'Your feedback has been submitted successfully.');
          navigation.goBack();
        } catch (error) {
          console.error('Error submitting feedback:', error);
          Alert.alert('Error', 'Could not submit feedback. Please try again.');
        }
      });
    };
      
    

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Feedback</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.formContainer}>
          <Text style={styles.header}>👋 Help us improve</Text>

          {/* Usage Frequency */}
          <Text style={styles.label}>How often do you use our app?</Text>
          <TextInput
            style={styles.input}
            placeholder="Everyday/once a week/bi-weekly"
            placeholderTextColor="#888"
            value={usageFrequency}
            onChangeText={setUsageFrequency}
          />

          {/* Motivation */}
          <Text style={styles.label}>What is the motivation to use our app?</Text>
          <TextInput
            style={styles.input}
            placeholder="What problem does it solve for you?"
            placeholderTextColor="#888"
            value={motivation}
            onChangeText={setMotivation}
          />

          {/* Most Used Feature */}
          <Text style={styles.label}>What is your most used feature?</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your most used feature"
            placeholderTextColor="#888"
            value={mostUsedFeature}
            onChangeText={setMostUsedFeature}
          />

          {/* Improvement Suggestion */}
          <Text style={styles.label}>What would you like to see improved the most?</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your suggestion"
            placeholderTextColor="#888"
            value={improvementSuggestion}
            onChangeText={setImprovementSuggestion}
          />

          {/* Personal Follow-Up */}
          <View style={styles.checkboxContainer}>
            <Checkbox
              value={followUp}
              onValueChange={setFollowUp}
              color={followUp ? '#FF8C00' : undefined}
            />
            <Text style={styles.checkboxLabel}>Receive personal follow-up to your feedback.</Text>
          </View>

          {/* General Information */}
          <Text style={styles.label}>Name:</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor="#888"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Phone:</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your phone number"
            placeholderTextColor="#888"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Age:</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your age"
            placeholderTextColor="#888"
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
          />

          <Text style={styles.label}>E-mail:</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your e-mail"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />

          {/* Feedback Type */}
          <Text style={styles.label}>Feedback Type:</Text>
          <View style={styles.radioGroupContainer}>
            <RadioButton.Group
              onValueChange={newValue => setFeedbackType(newValue)}
              value={feedbackType}
            >
              <View style={styles.radioButtonContainer}>
                <RadioButton value="comments" color="#FF8C00" uncheckedColor="#94A3B8" />
                <Text style={styles.radioLabel}>Comments</Text>
              </View>
              <View style={styles.radioButtonContainer}>
                <RadioButton value="suggestions" color="#FF8C00" uncheckedColor="#94A3B8" />
                <Text style={styles.radioLabel}>Suggestions</Text>
              </View>
              <View style={styles.radioButtonContainer}>
                <RadioButton value="questions" color="#FF8C00" uncheckedColor="#94A3B8" />
                <Text style={styles.radioLabel}>Questions</Text>
              </View>
            </RadioButton.Group>
          </View>

          {/* General Feedback */}
          <Text style={styles.label}>Describe Your Feedback:</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your feedback"
            placeholderTextColor="#888"
            value={generalFeedback}
            onChangeText={setGeneralFeedback}
            multiline
          />

          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.submitButton}
            buttonColor="#FF8C00"
            textColor="#0A0C10"
          >
            Submit Feedback
          </Button>
        </ScrollView>
      </SafeAreaView>
    );
  };

// Rate Us Screen
const RateUsScreen = ({ navigation }) => {
    const [rating, setRating] = React.useState(0);
    const [incentiveEarned, setIncentiveEarned] = React.useState(false);
    const [submitted, setSubmitted] = React.useState(false);

    const handleRating = (value) => {
      setRating(value);
      setSubmitted(false);
      if (value > 0) {
        setIncentiveEarned(true);
      }
    };

    const handleSubmit = () => {
      if (rating === 0) {
        Alert.alert('Rating Required', 'Please select a star rating before submitting.');
        return;
      }
      setSubmitted(true);
      Alert.alert('Thank You!', `Thanks for rating TuneHub ${rating}/5 stars.`);
      navigation.goBack();
    };

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rate Us</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.formContainer}>
          <Text style={styles.header}>⭐ Rate Us!</Text>
          <Text style={styles.subHeader}>Your feedback helps us make this app better for you!</Text>

          {/* Rating Section */}
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => handleRating(star)}>
                <AntDesign
                  name={star <= rating ? "star" : "staro"}
                  size={40}
                  color={star <= rating ? '#FF8C00' : '#888'}
                />
              </TouchableOpacity>
            ))}
          </View>

          {incentiveEarned && (
            <View style={styles.incentiveContainer}>
              <Text style={styles.incentiveText}>Thanks for selecting {rating}/5 stars!</Text>
            </View>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.submitButton}
            buttonColor="#FF8C00"
            textColor="#0A0C10"
          >
            Submit Rating
          </Button>

          {(submitted || incentiveEarned) && (
            <Text style={styles.thankYouText}>Thank you for helping us improve!</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  };

// Bug Report Form Screen
const BugReportForm = ({ navigation }) => {
  const [bugDescription, setBugDescription] = React.useState('');

  const handleSubmit = () => {
    const validation = validateFeedbackPayload(bugDescription);
    if (!validation.ok) {
      Alert.alert('Description Required', validation.error);
      return;
    }
    Alert.alert('Bug Report Received', 'Thank you — our engineering team has logged your report.');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bug Report</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.formContainer}>
        <Text style={styles.label}>Describe the Bug:</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter bug description"
          placeholderTextColor="#888"
          value={bugDescription}
          onChangeText={setBugDescription}
          multiline
        />
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.submitButton}
          buttonColor="#FF8C00"
          textColor="#0A0C10"
        >
          Submit Bug Report
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0C10',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    backgroundColor: '#242424',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  formContainer: {
    padding: 20,
  },
  label: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 10,
  },
  header: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
},
subHeader: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  incentiveContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  incentiveText: {
    color: '#FFD700',
    fontSize: 16,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#151821',
    color: '#ffffff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#FF8C00',
    borderRadius: 12,
    marginTop: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkboxLabel: {
    color: '#ffffff',
    marginLeft: 8,
  },
  radioGroupContainer: {
    marginBottom: 20,
  },
  radioButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  radioLabel: {
    color: '#F8FAFC',
    marginLeft: 8,
  },
  thankYouText: {
    color: '#ffffff',
    marginTop: 20,
    textAlign: 'center',
    fontSize: 16,
  },
});

export { FeedbackForm, RateUsScreen, BugReportForm };
