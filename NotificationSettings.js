import React, { useState } from 'react';
import { SafeAreaView, ScrollView, View, StyleSheet, Text, Switch, TouchableOpacity } from 'react-native';
import { List, Divider } from 'react-native-paper';

const NotificationSettings = ({ navigation }) => {
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [friendRequestsNotifications, setFriendRequestsNotifications] = useState(false);
  const [mentionsCommentsNotifications, setMentionsCommentsNotifications] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView>
        {/* Email Notifications */}
        <List.Section title="Email Notifications" style={styles.section}>
          <View style={styles.item}>
            <Text style={styles.itemText}>Email Notifications</Text>
            <Switch
              value={emailNotifications}
              onValueChange={() => setEmailNotifications(!emailNotifications)}
              trackColor={{ false: "#767577", true: "#007AFF" }}
              thumbColor={emailNotifications ? "#007AFF" : "#f4f3f4"}
            />
          </View>
        </List.Section>
        <Divider style={styles.divider} />

        {/* Push Notifications */}
        <List.Section title="Push Notifications" style={styles.section}>
          <View style={styles.item}>
            <Text style={styles.itemText}>Push Notifications</Text>
            <Switch
              value={pushNotifications}
              onValueChange={() => setPushNotifications(!pushNotifications)}
              trackColor={{ false: "#767577", true: "#007AFF" }}
              thumbColor={pushNotifications ? "#007AFF" : "#f4f3f4"}
            />
          </View>
        </List.Section>
        <Divider style={styles.divider} />

        {/* Friend Requests Notifications */}
        <List.Section title="Friend Requests Notifications" style={styles.section}>
          <View style={styles.item}>
            <Text style={styles.itemText}>Friend Requests Notifications</Text>
            <Switch
              value={friendRequestsNotifications}
              onValueChange={() => setFriendRequestsNotifications(!friendRequestsNotifications)}
              trackColor={{ false: "#767577", true: "#007AFF" }}
              thumbColor={friendRequestsNotifications ? "#007AFF" : "#f4f3f4"}
            />
          </View>
        </List.Section>
        <Divider style={styles.divider} />

        {/* Mentions and Comments Notifications */}
        <List.Section title="Mentions and Comments Notifications" style={styles.section}>
          <View style={styles.item}>
            <Text style={styles.itemText}>Mentions & Comments Notifications</Text>
            <Switch
              value={mentionsCommentsNotifications}
              onValueChange={() => setMentionsCommentsNotifications(!mentionsCommentsNotifications)}
              trackColor={{ false: "#767577", true: "#007AFF" }}
              thumbColor={mentionsCommentsNotifications ? "#007AFF" : "#f4f3f4"}
            />
          </View>
        </List.Section>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
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
  section: {
    paddingHorizontal: 20,
    color: '#ffffff',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
  },
  itemText: {
    fontSize: 16,
    color: '#ffffff',
  },
  divider: {
    backgroundColor: '#444',
  },
});

export default NotificationSettings;
